import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 已发布试卷列表（含我的进行中 / 最近成绩状态）
router.get('/papers', (req, res) => {
  const papers = db
    .prepare(
      `SELECT p.id, p.title, p.duration_minutes, p.pass_score, s.name AS subject,
        (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count,
        (SELECT COALESCE(SUM(pq.score), 0) FROM paper_questions pq WHERE pq.paper_id = p.id) AS total_score
      FROM papers p JOIN subjects s ON s.id = p.subject_id
      WHERE p.status = 'published'
      ORDER BY p.id DESC`
    )
    .all();

  const inProgress = db
    .prepare(`SELECT id, paper_id, started_at FROM exam_records WHERE user_id = ? AND status = 'in_progress'`)
    .all(req.user.id);
  const inProgressMap = new Map(inProgress.map((r) => [r.paper_id, r]));

  const submitted = db
    .prepare(
      `SELECT er.id, er.paper_id, er.total_score, er.submitted_at, er.self_scored, p.pass_score
      FROM exam_records er JOIN papers p ON p.id = er.paper_id
      WHERE er.user_id = ? AND er.status = 'submitted'
      ORDER BY er.submitted_at DESC`
    )
    .all(req.user.id);
  const latestMap = new Map();
  for (const r of submitted) if (!latestMap.has(r.paper_id)) latestMap.set(r.paper_id, r);

  res.json({
    papers: papers.map((p) => {
      const ip = inProgressMap.get(p.id);
      const lt = latestMap.get(p.id);
      return {
        ...p,
        myInProgress: ip ? { recordId: ip.id, startedAt: ip.started_at } : null,
        myLatest: lt
          ? {
              recordId: lt.id,
              totalScore: lt.total_score,
              submittedAt: lt.submitted_at,
              selfScored: !!lt.self_scored,
              passed: lt.total_score != null && lt.total_score >= p.pass_score,
            }
          : null,
      };
    }),
  });
});

export default router;
