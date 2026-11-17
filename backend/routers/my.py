"""我的成绩：列表与详情回看（含正确答案与解析）"""
import json

from fastapi import APIRouter, Depends, HTTPException

from database import connect
from security import get_current_user

router = APIRouter()


# 我的成绩列表
@router.get("/api/my/results")
def list_results(user=Depends(get_current_user)):
    conn = connect()
    try:
        rows = conn.execute(
            """SELECT er.id, er.total_score, er.submitted_at, er.self_scored,
                    p.title, p.pass_score, s.name AS subject
            FROM exam_records er
            JOIN papers p ON p.id = er.paper_id
            JOIN subjects s ON s.id = p.subject_id
            WHERE er.user_id = ? AND er.status = 'submitted'
            ORDER BY er.submitted_at DESC""",
            (user["id"],),
        ).fetchall()
        return {
            "results": [
                {
                    "id": r["id"],
                    "paperTitle": r["title"],
                    "subject": r["subject"],
                    "totalScore": r["total_score"],
                    "passScore": r["pass_score"],
                    "passed": r["total_score"] is not None and r["total_score"] >= r["pass_score"],
                    "selfScored": bool(r["self_scored"]),
                    "submittedAt": r["submitted_at"],
                }
                for r in rows
            ]
        }
    finally:
        conn.close()


# 成绩详情（试卷回看）
@router.get("/api/my/results/{record_id}")
def result_detail(record_id: int, user=Depends(get_current_user)):
    conn = connect()
    try:
        rec = conn.execute(
            "SELECT * FROM exam_records WHERE id = ? AND user_id = ? AND status = 'submitted'",
            (record_id, user["id"]),
        ).fetchone()
        if rec is None:
            raise HTTPException(status_code=404, detail="成绩记录不存在")

        paper = conn.execute(
            """SELECT p.*, s.name AS subject_name
            FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?""",
            (rec["paper_id"],),
        ).fetchone()
        questions = conn.execute(
            """SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options,
                      q.answer, q.answer_text, q.analysis
            FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
            WHERE pq.paper_id = ? ORDER BY pq.sort""",
            (rec["paper_id"],),
        ).fetchall()

        return {
            "record": {
                "id": rec["id"],
                "status": rec["status"],
                "startedAt": rec["started_at"],
                "submittedAt": rec["submitted_at"],
                "totalScore": rec["total_score"],
                "selfScored": bool(rec["self_scored"]),
                "answers": json.loads(rec["answers"] or "[]"),
                "scores": json.loads(rec["scores"] or "[]"),
            },
            "paper": {
                "id": paper["id"],
                "title": paper["title"],
                "subject": paper["subject_name"],
                "durationMinutes": paper["duration_minutes"],
                "passScore": paper["pass_score"],
                "totalScore": sum(q["score"] for q in questions),
            },
            "questions": [
                dict(q) | {"options": json.loads(q["options"]) if q["options"] else None}
                for q in questions
            ],
        }
    finally:
        conn.close()
