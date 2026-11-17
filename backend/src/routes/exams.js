import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { gradeSubmission } from '../grading.js';

const router = Router();
router.use(requireAuth);

// 试卷题目（考试中：不含正确答案）
function loadPaperForExam(paperId) {
  const paper = db
    .prepare(`SELECT p.*, s.name AS subject_name FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?`)
    .get(paperId);
  if (!paper) return null;
  const questions = db
    .prepare(
      `SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options
      FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
      WHERE pq.paper_id = ?
      ORDER BY pq.sort`
    )
    .all(paperId)
    .map((q) => ({ ...q, options: q.options ? JSON.parse(q.options) : null }));
  return { paper, questions };
}

// 试卷题目（判分/回看：含正确答案与解析）
function loadPaperWithAnswers(paperId) {
  const paper = db
    .prepare(`SELECT p.*, s.name AS subject_name FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?`)
    .get(paperId);
  if (!paper) return null;
  const questions = db
    .prepare(
      `SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem, q.options, q.answer, q.answer_text, q.analysis
      FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
      WHERE pq.paper_id = ?
      ORDER BY pq.sort`
    )
    .all(paperId)
    .map((q) => ({ ...q, options: q.options ? JSON.parse(q.options) : null }));
  return { paper, questions };
}

function getRecord(recordId, userId) {
  return db.prepare('SELECT * FROM exam_records WHERE id = ? AND user_id = ?').get(recordId, userId);
}

// 开始/恢复考试
router.post('/', (req, res) => {
  const { paperId } = req.body || {};
  const paper = db.prepare(`SELECT * FROM papers WHERE id = ? AND status = 'published'`).get(paperId);
  if (!paper) return res.status(404).json({ error: '试卷不存在或未发布' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM paper_questions WHERE paper_id = ?').get(paperId).c;
  if (!count) return res.status(400).json({ error: '该试卷还没有题目，请联系管理员' });

  const existing = db
    .prepare(`SELECT id FROM exam_records WHERE user_id = ? AND paper_id = ? AND status = 'in_progress'`)
    .get(req.user.id, paperId);
  if (existing) return res.json({ recordId: existing.id, resumed: true });

  const r = db
    .prepare(`INSERT INTO exam_records (user_id, paper_id, started_at) VALUES (?, ?, ?)`)
    .run(req.user.id, paperId, new Date().toISOString());
  res.json({ recordId: Number(r.lastInsertRowid), resumed: false });
});

// 考试状态 + 题目（断点续考：含已存答案与剩余时间）
router.get('/:id', (req, res) => {
  const rec = getRecord(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ error: '考试记录不存在' });
  const loaded = loadPaperForExam(rec.paper_id);
  if (!loaded) return res.status(404).json({ error: '试卷不存在' });

  const elapsedSec = Math.floor((Date.now() - Date.parse(rec.started_at)) / 1000);
  const remainSec = Math.max(0, loaded.paper.duration_minutes * 60 - elapsedSec);

  // 超时未交卷 → 服务端自动交卷
  if (rec.status === 'in_progress' && remainSec <= 0) {
    return finalizeAndRespond(rec, loaded, req, res, true);
  }

  res.json({
    record: {
      id: rec.id,
      status: rec.status,
      startedAt: rec.started_at,
      remainSeconds: remainSec,
      answers: JSON.parse(rec.answers || '[]'),
    },
    paper: {
      id: loaded.paper.id,
      title: loaded.paper.title,
      subject: loaded.paper.subject_name,
      durationMinutes: loaded.paper.duration_minutes,
      passScore: loaded.paper.pass_score,
    },
    questions: loaded.questions,
  });
});

// 保存答案（整包覆盖，节流调用）
router.put('/:id/answers', (req, res) => {
  const rec = getRecord(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ error: '考试记录不存在' });
  if (rec.status !== 'in_progress') return res.status(400).json({ error: '考试已结束' });
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers 必须为数组' });
  const clean = answers.slice(0, 500).map((a) => ({
    questionId: Number(a.questionId),
    value: a.value === undefined ? null : a.value,
    marked: !!a.marked,
  }));
  db.prepare('UPDATE exam_records SET answers = ? WHERE id = ?').run(JSON.stringify(clean), rec.id);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

function finalizeAndRespond(rec, loaded, req, res, auto) {
  const answerMap = new Map(JSON.parse(rec.answers || '[]').map((a) => [a.questionId, a.value]));
  const { scores, total } = gradeSubmission(loaded.questions, answerMap);
  db.prepare(
    `UPDATE exam_records SET status = 'submitted', submitted_at = ?, scores = ?, total_score = ? WHERE id = ?`
  ).run(new Date().toISOString(), JSON.stringify(scores), total, rec.id);
  res.json({ ok: true, recordId: rec.id, totalScore: total, autoSubmitted: !!auto });
}

// 交卷
router.post('/:id/submit', (req, res) => {
  const rec = getRecord(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ error: '考试记录不存在' });
  if (rec.status === 'submitted') return res.json({ ok: true, recordId: rec.id, alreadySubmitted: true });
  const loaded = loadPaperWithAnswers(rec.paper_id);
  finalizeAndRespond(rec, loaded, req, res, false);
});

// 主观题自评计分
router.put('/:id/self-score', (req, res) => {
  const rec = getRecord(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ error: '考试记录不存在' });
  if (rec.status !== 'submitted') return res.status(400).json({ error: '请先交卷再自评' });
  const { questionId, score } = req.body || {};
  const scores = JSON.parse(rec.scores || '[]');
  const item = scores.find((x) => x.questionId === Number(questionId));
  if (!item || item.auto) return res.status(400).json({ error: '该题不支持自评' });
  const capped = Math.max(0, Math.min(item.max, Number(score) || 0));
  item.score = Math.round(capped * 100) / 100;
  const total = scores.reduce((s, x) => s + (x.score ?? 0), 0);
  db.prepare(`UPDATE exam_records SET scores = ?, total_score = ?, self_scored = 1 WHERE id = ?`).run(
    JSON.stringify(scores),
    total,
    rec.id
  );
  res.json({ ok: true, totalScore: total });
});

export default router;
