import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// 我的成绩列表
router.get('/results', (req, res) => {
  const rows = db
    .prepare(
      `SELECT er.id, er.total_score, er.submitted_at, er.self_scored,
              p.title, p.pass_score, s.name AS subject
      FROM exam_records er
      JOIN papers p ON p.id = er.paper_id
      JOIN subjects s ON s.id = p.subject_id
      WHERE er.user_id = ? AND er.status = 'submitted'
      ORDER BY er.submitted_at DESC`
    )
    .all(req.user.id);
  res.json({
    results: rows.map((r) => ({
      id: r.id,
      paperTitle: r.title,
      subject: r.subject,
      totalScore: r.total_score,
      passScore: r.pass_score,
      passed: r.total_score != null && r.total_score >= r.pass_score,
      selfScored: !!r.self_scored,
      submittedAt: r.submitted_at,
    })),
  });
});

// 成绩详情（试卷回看：含正确答案与解析）
router.get('/results/:id', (req, res) => {
  const rec = db
    .prepare('SELECT * FROM exam_records WHERE id = ? AND user_id = ? AND status = ?')
    .get(req.params.id, req.user.id, 'submitted');
  if (!rec) return res.status(404).json({ error: '成绩记录不存在' });

  const paper = db
    .prepare(`SELECT p.*, s.name AS subject_name FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?`)
    .get(rec.paper_id);
  const questions = db
    .prepare(
      `SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options, q.answer, q.answer_text, q.analysis
      FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
      WHERE pq.paper_id = ?
      ORDER BY pq.sort`
    )
    .all(rec.paper_id)
    .map((q) => ({ ...q, options: q.options ? JSON.parse(q.options) : null }));

  res.json({
    record: {
      id: rec.id,
      status: rec.status,
      startedAt: rec.started_at,
      submittedAt: rec.submitted_at,
      totalScore: rec.total_score,
      selfScored: !!rec.self_scored,
      answers: JSON.parse(rec.answers || '[]'),
      scores: JSON.parse(rec.scores || '[]'),
    },
    paper: {
      id: paper.id,
      title: paper.title,
      subject: paper.subject_name,
      durationMinutes: paper.duration_minutes,
      passScore: paper.pass_score,
      totalScore: questions.reduce((s, q) => s + q.score, 0),
    },
    questions,
  });
});

export default router;
