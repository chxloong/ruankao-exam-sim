"""考试流程：开始/恢复、作答状态、保存答案、交卷、主观题自评"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import connect
from grading import grade_submission
from security import get_current_user

router = APIRouter()

OPTION_PREFIX_ERROR = "考试记录不存在"


def _not_found(message: str = "考试记录不存在") -> HTTPException:
    return HTTPException(status_code=404, detail=message)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


class StartExamBody(BaseModel):
    paperId: int


class AnswersBody(BaseModel):
    answers: list[dict]


class SelfScoreBody(BaseModel):
    questionId: int
    score: float


def _load_paper(conn, paper_id: int, with_answers: bool):
    paper = conn.execute(
        """SELECT p.*, s.name AS subject_name
        FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?""",
        (paper_id,),
    ).fetchone()
    if paper is None:
        return None
    if with_answers:
        cols = "pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options, q.answer, q.answer_text, q.analysis"
    else:
        cols = "pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options"
    questions = conn.execute(
        f"""SELECT {cols}
        FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
        WHERE pq.paper_id = ? ORDER BY pq.sort""",
        (paper_id,),
    ).fetchall()
    questions = [dict(q) | {"options": json.loads(q["options"]) if q["options"] else None} for q in questions]
    return {"paper": dict(paper), "questions": questions}


def _get_record(conn, record_id: int, user_id: int):
    return conn.execute(
        "SELECT * FROM exam_records WHERE id = ? AND user_id = ?", (record_id, user_id)
    ).fetchone()


def _finalize(conn, rec, loaded, auto: bool) -> dict:
    """客观题自动判分并落库（交卷 / 超时自动交卷共用）"""
    answers = json.loads(rec["answers"] or "[]")
    answer_map = {a["questionId"]: a.get("value") for a in answers}
    scores, total = grade_submission(loaded["questions"], answer_map)
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE exam_records SET status = 'submitted', submitted_at = ?, scores = ?, total_score = ? WHERE id = ?",
        (now, json.dumps(scores, ensure_ascii=False), total, rec["id"]),
    )
    conn.commit()
    return {"ok": True, "recordId": rec["id"], "totalScore": total, "autoSubmitted": bool(auto)}


# 开始 / 恢复考试
@router.post("/api/exams")
def start_exam(body: StartExamBody, user=Depends(get_current_user)):
    conn = connect()
    try:
        paper = conn.execute(
            "SELECT * FROM papers WHERE id = ? AND status = 'published'", (body.paperId,)
        ).fetchone()
        if paper is None:
            raise _bad_request("试卷不存在或未发布")
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM paper_questions WHERE paper_id = ?", (body.paperId,)
        ).fetchone()["c"]
        if not count:
            raise _bad_request("该试卷还没有题目，请联系管理员")

        existing = conn.execute(
            "SELECT id FROM exam_records WHERE user_id = ? AND paper_id = ? AND status = 'in_progress'",
            (user["id"], body.paperId),
        ).fetchone()
        if existing:
            return {"recordId": existing["id"], "resumed": True}

        now = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            "INSERT INTO exam_records (user_id, paper_id, started_at) VALUES (?, ?, ?)",
            (user["id"], body.paperId, now),
        )
        conn.commit()
        return {"recordId": cur.lastrowid, "resumed": False}
    finally:
        conn.close()


# 考试状态 + 题目（断点续考：含已存答案与剩余时间）
@router.get("/api/exams/{record_id}")
def exam_state(record_id: int, user=Depends(get_current_user)):
    conn = connect()
    try:
        rec = _get_record(conn, record_id, user["id"])
        if rec is None:
            raise _not_found()
        loaded = _load_paper(conn, rec["paper_id"], with_answers=False)
        if loaded is None:
            raise _not_found("试卷不存在")

        started = datetime.fromisoformat(rec["started_at"])
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        remain = max(0, loaded["paper"]["duration_minutes"] * 60 - int(elapsed))

        # 超时未交卷 → 服务端自动交卷
        if rec["status"] == "in_progress" and remain <= 0:
            return _finalize(conn, rec, loaded, auto=True)

        return {
            "record": {
                "id": rec["id"],
                "status": rec["status"],
                "startedAt": rec["started_at"],
                "remainSeconds": remain,
                "answers": json.loads(rec["answers"] or "[]"),
            },
            "paper": {
                "id": loaded["paper"]["id"],
                "title": loaded["paper"]["title"],
                "subject": loaded["paper"]["subject_name"],
                "durationMinutes": loaded["paper"]["duration_minutes"],
                "passScore": loaded["paper"]["pass_score"],
            },
            "questions": loaded["questions"],
        }
    finally:
        conn.close()


# 保存答案（整包覆盖，节流调用）
@router.put("/api/exams/{record_id}/answers")
def save_answers(record_id: int, body: AnswersBody, user=Depends(get_current_user)):
    conn = connect()
    try:
        rec = _get_record(conn, record_id, user["id"])
        if rec is None:
            raise _not_found()
        if rec["status"] != "in_progress":
            raise _bad_request("考试已结束")
        clean = [
            {
                "questionId": a.get("questionId"),
                "value": a.get("value"),
                "marked": bool(a.get("marked")),
            }
            for a in body.answers[:500]
        ]
        conn.execute(
            "UPDATE exam_records SET answers = ? WHERE id = ?",
            (json.dumps(clean, ensure_ascii=False), rec["id"]),
        )
        conn.commit()
        return {"ok": True, "savedAt": datetime.now(timezone.utc).isoformat()}
    finally:
        conn.close()


# 交卷
@router.post("/api/exams/{record_id}/submit")
def submit_exam(record_id: int, user=Depends(get_current_user)):
    conn = connect()
    try:
        rec = _get_record(conn, record_id, user["id"])
        if rec is None:
            raise _not_found()
        if rec["status"] == "submitted":
            return {"ok": True, "recordId": rec["id"], "alreadySubmitted": True}
        loaded = _load_paper(conn, rec["paper_id"], with_answers=True)
        return _finalize(conn, rec, loaded, auto=False)
    finally:
        conn.close()


# 主观题自评计分
@router.put("/api/exams/{record_id}/self-score")
def self_score(record_id: int, body: SelfScoreBody, user=Depends(get_current_user)):
    conn = connect()
    try:
        rec = _get_record(conn, record_id, user["id"])
        if rec is None:
            raise _not_found()
        if rec["status"] != "submitted":
            raise _bad_request("请先交卷再自评")
        scores = json.loads(rec["scores"] or "[]")
        item = next((x for x in scores if x["questionId"] == body.questionId), None)
        if item is None or item.get("auto"):
            raise _bad_request("该题不支持自评")
        capped = max(0.0, min(item["max"], body.score or 0))
        item["score"] = round(capped, 2)
        total = sum(x["score"] or 0 for x in scores)
        conn.execute(
            "UPDATE exam_records SET scores = ?, total_score = ?, self_scored = 1 WHERE id = ?",
            (json.dumps(scores, ensure_ascii=False), total, rec["id"]),
        )
        conn.commit()
        return {"ok": True, "totalScore": total}
    finally:
        conn.close()
