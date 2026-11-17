"""学生端：已发布试卷列表"""
from fastapi import APIRouter, Depends

from database import connect
from security import get_current_user

router = APIRouter()


@router.get("/api/papers")
def list_papers(user=Depends(get_current_user)):
    conn = connect()
    try:
        papers = conn.execute(
            """SELECT p.id, p.title, p.duration_minutes, p.pass_score, s.name AS subject,
                (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count,
                (SELECT COALESCE(SUM(pq.score), 0) FROM paper_questions pq WHERE pq.paper_id = p.id) AS total_score
            FROM papers p JOIN subjects s ON s.id = p.subject_id
            WHERE p.status = 'published'
            ORDER BY p.id DESC"""
        ).fetchall()

        in_progress = conn.execute(
            "SELECT id, paper_id, started_at FROM exam_records WHERE user_id = ? AND status = 'in_progress'",
            (user["id"],),
        ).fetchall()
        in_progress_map = {r["paper_id"]: r for r in in_progress}

        submitted = conn.execute(
            """SELECT er.id, er.paper_id, er.total_score, er.submitted_at, er.self_scored, p.pass_score
            FROM exam_records er JOIN papers p ON p.id = er.paper_id
            WHERE er.user_id = ? AND er.status = 'submitted'
            ORDER BY er.submitted_at DESC""",
            (user["id"],),
        ).fetchall()
        latest_map = {}
        for r in submitted:
            latest_map.setdefault(r["paper_id"], r)

        result = []
        for p in papers:
            paper_id = p["id"]
            ip = in_progress_map.get(paper_id)
            lt = latest_map.get(paper_id)
            result.append(
                {
                    "id": p["id"],
                    "title": p["title"],
                    "duration_minutes": p["duration_minutes"],
                    "pass_score": p["pass_score"],
                    "subject": p["subject"],
                    "question_count": p["question_count"],
                    "total_score": p["total_score"],
                    "myInProgress": (
                        {"recordId": ip["id"], "startedAt": ip["started_at"]} if ip else None
                    ),
                    "myLatest": (
                        {
                            "recordId": lt["id"],
                            "totalScore": lt["total_score"],
                            "submittedAt": lt["submitted_at"],
                            "selfScored": bool(lt["self_scored"]),
                            "passed": lt["total_score"] is not None and lt["total_score"] >= p["pass_score"],
                        }
                        if lt
                        else None
                    ),
                }
            )
        return {"papers": result}
    finally:
        conn.close()
