"""管理端：科目、题库（含 JSON 导入）、试卷、用户"""
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import connect
from security import require_admin

router = APIRouter()

OPTION_PREFIX = re.compile(r"^[A-Ha-h][.、．:：)）]\s*")
QUESTION_TYPES = ("single", "multiple", "text")


def _bad(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail=message)


def _validate_question(body: dict):
    """校验并规整一道题，返回 (errors, data)；与原 Node 版规则一致"""
    errors = []
    qtype = body.get("type")
    if qtype not in QUESTION_TYPES:
        errors.append("题型 type 必须是 single/multiple/text")
    stem = str(body.get("stem") or "").strip()
    if not stem:
        errors.append("题干 stem 不能为空")

    options = None
    answer = None
    answer_text = None

    if qtype in ("single", "multiple"):
        raw_options = body.get("options")
        if not isinstance(raw_options, list) or len(raw_options) < 2:
            errors.append("选择题 options 至少 2 个选项")
        else:
            options = [OPTION_PREFIX.sub("", str(t)).strip() for t in raw_options]
        if options:
            letters = sorted(set(re.sub(r"[^A-H]", "", str(body.get("answer") or "").upper())))
            if any(ord(c) - 65 >= len(options) for c in letters):
                errors.append("answer 中的选项字母超出选项数量")
            if qtype == "single" and len(letters) != 1:
                errors.append("单选题 answer 必须是 1 个字母")
            if qtype == "multiple" and len(letters) < 2:
                errors.append("多选题 answer 至少 2 个字母")
            answer = "".join(letters)
    else:
        answer_text = str(body.get("answerText") or "").strip()
        if not answer_text:
            errors.append("主观题 answerText（参考答案）不能为空")

    analysis = body.get("analysis")
    data = {
        "type": qtype,
        "stem": stem,
        "options": json.dumps(options, ensure_ascii=False) if options is not None else None,
        "answer": answer,
        "answer_text": answer_text,
        "analysis": str(analysis).strip() if analysis else None,
    }
    return errors, data


# ---------- 科目 ----------
@router.get("/api/admin/subjects")
def list_subjects(user=Depends(require_admin)):
    conn = connect()
    try:
        rows = conn.execute("SELECT * FROM subjects ORDER BY id").fetchall()
        return {"subjects": [dict(r) for r in rows]}
    finally:
        conn.close()


class SubjectBody(BaseModel):
    name: str


@router.post("/api/admin/subjects")
def create_subject(body: SubjectBody, user=Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise _bad("科目名称不能为空")
    conn = connect()
    try:
        try:
            cur = conn.execute("INSERT INTO subjects (name) VALUES (?)", (name,))
            conn.commit()
        except Exception:
            raise _bad("科目已存在")
        return {"id": cur.lastrowid, "name": name}
    finally:
        conn.close()


# ---------- 题目 ----------
@router.get("/api/admin/questions")
def list_questions(
    subjectId: Optional[int] = None,
    type: Optional[str] = None,
    keyword: Optional[str] = None,
    user=Depends(require_admin),
):
    conn = connect()
    try:
        where, params = [], []
        if subjectId:
            where.append("q.subject_id = ?")
            params.append(subjectId)
        if type:
            where.append("q.type = ?")
            params.append(type)
        if keyword:
            where.append("q.stem LIKE ?")
            params.append(f"%{keyword}%")
        sql = f"""SELECT q.*, s.name AS subject_name FROM questions q
            JOIN subjects s ON s.id = q.subject_id
            {'WHERE ' + ' AND '.join(where) if where else ''}
            ORDER BY q.id DESC LIMIT 500"""
        rows = conn.execute(sql, params).fetchall()
        return {
            "questions": [
                dict(r) | {"options": json.loads(r["options"]) if r["options"] else None}
                for r in rows
            ]
        }
    finally:
        conn.close()


class QuestionBody(BaseModel):
    subjectId: Optional[int] = None
    type: Optional[str] = None
    stem: Optional[str] = None
    options: Optional[list[str]] = None
    answer: Optional[str] = None
    answerText: Optional[str] = None
    analysis: Optional[str] = None


@router.post("/api/admin/questions")
def create_question(body: QuestionBody, user=Depends(require_admin)):
    if not body.subjectId:
        raise _bad("缺少科目 subjectId")
    conn = connect()
    try:
        subject = conn.execute("SELECT id FROM subjects WHERE id = ?", (body.subjectId,)).fetchone()
        if subject is None:
            raise _bad("科目不存在")
        errors, data = _validate_question(body.model_dump())
        if errors:
            raise _bad("；".join(errors))
        cur = conn.execute(
            "INSERT INTO questions (subject_id, type, stem, options, answer, answer_text, analysis) VALUES (?,?,?,?,?,?,?)",
            (body.subjectId, data["type"], data["stem"], data["options"], data["answer"], data["answer_text"], data["analysis"]),
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.put("/api/admin/questions/{question_id}")
def update_question(question_id: int, body: QuestionBody, user=Depends(require_admin)):
    conn = connect()
    try:
        existing = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
        if existing is None:
            raise _not_found("题目不存在")
        payload = body.model_dump()
        payload.setdefault("type", existing["type"])
        errors, data = _validate_question(payload)
        if errors:
            raise _bad("；".join(errors))
        conn.execute(
            "UPDATE questions SET type=?, stem=?, options=?, answer=?, answer_text=?, analysis=? WHERE id=?",
            (data["type"], data["stem"], data["options"], data["answer"], data["answer_text"], data["analysis"], question_id),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/admin/questions/{question_id}")
def delete_question(question_id: int, user=Depends(require_admin)):
    conn = connect()
    try:
        used = conn.execute(
            "SELECT COUNT(*) AS c FROM paper_questions WHERE question_id = ?", (question_id,)
        ).fetchone()["c"]
        if used > 0:
            raise _bad("该题已被试卷引用，请先从试卷中移除")
        conn.execute("DELETE FROM questions WHERE id = ?", (question_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


class ImportBody(BaseModel):
    subjectId: Optional[int] = None
    subjectName: Optional[str] = None
    questions: list[dict]


@router.post("/api/admin/questions/import")
def import_questions(body: ImportBody, user=Depends(require_admin)):
    if not body.questions:
        raise _bad("questions 不能为空")
    conn = connect()
    try:
        subject = None
        if body.subjectId:
            subject = conn.execute("SELECT * FROM subjects WHERE id = ?", (body.subjectId,)).fetchone()
            if subject is None:
                raise _bad("科目不存在")
        elif body.subjectName:
            name = body.subjectName.strip()
            subject = conn.execute("SELECT * FROM subjects WHERE name = ?", (name,)).fetchone()
            if subject is None:
                cur = conn.execute("INSERT INTO subjects (name) VALUES (?)", (name,))
                subject = {"id": cur.lastrowid, "name": name}
        else:
            raise _bad("需提供 subjectId 或 subjectName")

        inserted, errors = [], []
        for i, q in enumerate(body.questions):
            errs, data = _validate_question(q)
            if errs:
                errors.append({"index": i, "stem": str(q.get("stem") or "")[:30], "errors": errs})
                continue
            cur = conn.execute(
                "INSERT INTO questions (subject_id, type, stem, options, answer, answer_text, analysis) VALUES (?,?,?,?,?,?,?)",
                (subject["id"], data["type"], data["stem"], data["options"], data["answer"], data["answer_text"], data["analysis"]),
            )
            inserted.append(cur.lastrowid)
        conn.commit()
        return {
            "insertedCount": len(inserted),
            "insertedIds": inserted,
            "subject": {"id": subject["id"], "name": subject["name"]},
            "errors": errors,
        }
    finally:
        conn.close()


# ---------- 试卷 ----------
def _replace_paper_questions(conn, paper_id: int, items: list[dict]):
    conn.execute("DELETE FROM paper_questions WHERE paper_id = ?", (paper_id,))
    errors = []
    for idx, item in enumerate(items):
        qid = item.get("questionId")
        q = conn.execute("SELECT id FROM questions WHERE id = ?", (qid,)).fetchone()
        if q is None:
            errors.append(f"第 {idx + 1} 项：题目 {qid} 不存在")
            continue
        section = str(item.get("section") or "综合知识").strip()
        try:
            score = float(item.get("score"))
        except (TypeError, ValueError):
            score = 0
        if not (score > 0):
            score = 1
        conn.execute(
            "INSERT INTO paper_questions (paper_id, question_id, section, sort, score) VALUES (?,?,?,?,?)",
            (paper_id, qid, section, idx, score),
        )
    return errors


class PaperBody(BaseModel):
    subjectId: Optional[int] = None
    title: Optional[str] = None
    durationMinutes: Optional[float] = None
    passScore: Optional[float] = None
    questions: Optional[list[dict]] = None


@router.get("/api/admin/papers")
def list_papers(user=Depends(require_admin)):
    conn = connect()
    try:
        rows = conn.execute(
            """SELECT p.*, s.name AS subject_name,
              (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count,
              (SELECT COALESCE(SUM(pq.score), 0) FROM paper_questions pq WHERE pq.paper_id = p.id) AS total_score,
              (SELECT COUNT(*) FROM exam_records er WHERE er.paper_id = p.id) AS exam_count
            FROM papers p JOIN subjects s ON s.id = p.subject_id ORDER BY p.id DESC"""
        ).fetchall()
        return {"papers": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.get("/api/admin/papers/{paper_id}")
def paper_detail(paper_id: int, user=Depends(require_admin)):
    conn = connect()
    try:
        paper = conn.execute(
            """SELECT p.*, s.name AS subject_name
            FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?""",
            (paper_id,),
        ).fetchone()
        if paper is None:
            raise _not_found("试卷不存在")
        questions = conn.execute(
            """SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem
            FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
            WHERE pq.paper_id = ? ORDER BY pq.sort""",
            (paper_id,),
        ).fetchall()
        return {"paper": dict(paper) | {"questions": [dict(q) for q in questions]}}
    finally:
        conn.close()


@router.post("/api/admin/papers")
def create_paper(body: PaperBody, user=Depends(require_admin)):
    title = (body.title or "").strip()
    if not title:
        raise _bad("试卷标题不能为空")
    conn = connect()
    try:
        subject = conn.execute("SELECT id FROM subjects WHERE id = ?", (body.subjectId,)).fetchone()
        if subject is None:
            raise _bad("科目不存在")
        if not body.questions:
            raise _bad("请至少选择一道题目")
        cur = conn.execute(
            "INSERT INTO papers (subject_id, title, duration_minutes, pass_score, status, created_by) VALUES (?,?,?,?, 'draft', ?)",
            (body.subjectId, title, int(body.durationMinutes or 150), float(body.passScore or 45), user["id"]),
        )
        paper_id = cur.lastrowid
        errors = _replace_paper_questions(conn, paper_id, body.questions)
        if errors:
            conn.rollback()
            raise _bad("；".join(errors))
        conn.commit()
        return {"id": paper_id}
    finally:
        conn.close()


@router.put("/api/admin/papers/{paper_id}")
def update_paper(paper_id: int, body: PaperBody, user=Depends(require_admin)):
    conn = connect()
    try:
        paper = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
        if paper is None:
            raise _not_found("试卷不存在")
        title = (body.title or "").strip() if body.title is not None else paper["title"]
        if not title:
            raise _bad("试卷标题不能为空")
        duration = int(body.durationMinutes) if body.durationMinutes is not None else paper["duration_minutes"]
        duration = max(1, duration)
        pass_score = float(body.passScore) if body.passScore is not None else paper["pass_score"]
        conn.execute(
            "UPDATE papers SET title = ?, duration_minutes = ?, pass_score = ? WHERE id = ?",
            (title, duration, pass_score, paper_id),
        )
        if body.questions:
            errors = _replace_paper_questions(conn, paper_id, body.questions)
            if errors:
                conn.rollback()
                raise _bad("；".join(errors))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


class PaperStatusBody(BaseModel):
    status: str


@router.put("/api/admin/papers/{paper_id}/status")
def set_paper_status(paper_id: int, body: PaperStatusBody, user=Depends(require_admin)):
    if body.status not in ("draft", "published"):
        raise _bad("status 必须是 draft 或 published")
    conn = connect()
    try:
        if body.status == "published":
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM paper_questions WHERE paper_id = ?", (paper_id,)
            ).fetchone()["c"]
            if not count:
                raise _bad("试卷没有题目，无法发布")
        conn.execute("UPDATE papers SET status = ? WHERE id = ?", (body.status, paper_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/api/admin/papers/{paper_id}")
def delete_paper(paper_id: int, user=Depends(require_admin)):
    conn = connect()
    try:
        exam_count = conn.execute(
            "SELECT COUNT(*) AS c FROM exam_records WHERE paper_id = ?", (paper_id,)
        ).fetchone()["c"]
        if exam_count > 0:
            raise _bad("该试卷已有考试记录，不能删除")
        conn.execute("DELETE FROM paper_questions WHERE paper_id = ?", (paper_id,))
        conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ---------- 用户 ----------
@router.get("/api/admin/users")
def list_users(user=Depends(require_admin)):
    conn = connect()
    try:
        rows = conn.execute("SELECT id, username, role, created_at FROM users ORDER BY id").fetchall()
        return {"users": [dict(r) for r in rows]}
    finally:
        conn.close()


class UserBody(BaseModel):
    role: str


@router.put("/api/admin/users/{user_id}")
def update_user(user_id: int, body: UserBody, admin=Depends(require_admin)):
    if body.role not in ("user", "admin"):
        raise _bad("role 必须是 user 或 admin")
    if user_id == admin["id"]:
        raise _bad("不能修改自己的角色")
    conn = connect()
    try:
        row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise _not_found("用户不存在")
        conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
