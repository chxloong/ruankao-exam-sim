import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const OPTION_PREFIX = /^[A-Ha-h][.、．:：)）]\s*/;

// ---------- 科目 ----------
router.get('/subjects', (req, res) => {
  res.json({ subjects: db.prepare('SELECT * FROM subjects ORDER BY id').all() });
});

router.post('/subjects', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: '科目名称不能为空' });
  try {
    const r = db.prepare('INSERT INTO subjects (name) VALUES (?)').run(String(name).trim());
    res.json({ id: Number(r.lastInsertRowid), name: String(name).trim() });
  } catch {
    res.status(400).json({ error: '科目已存在' });
  }
});

// ---------- 题目 ----------
function validateQuestionPayload(body) {
  const errors = [];
  const type = body.type;
  if (!['single', 'multiple', 'text'].includes(type)) errors.push('题型 type 必须是 single/multiple/text');
  if (!body.stem || !String(body.stem).trim()) errors.push('题干 stem 不能为空');

  let options = null;
  let answer = null;
  let answerText = null;

  if (type === 'single' || type === 'multiple') {
    if (!Array.isArray(body.options) || body.options.length < 2) {
      errors.push('选择题 options 至少 2 个选项');
    } else {
      options = body.options.map((t) => String(t).replace(OPTION_PREFIX, '').trim());
    }
    const rawAnswer = String(body.answer || '').toUpperCase().replace(/[^A-H]/g, '');
    const letters = [...new Set(rawAnswer.split(''))];
    if (options && letters.some((c) => c.charCodeAt(0) - 65 >= options.length)) {
      errors.push('answer 中的选项字母超出选项数量');
    }
    if (type === 'single' && letters.length !== 1) errors.push('单选题 answer 必须是 1 个字母');
    if (type === 'multiple' && letters.length < 2) errors.push('多选题 answer 至少 2 个字母');
    answer = letters.sort().join('');
  } else {
    if (!body.answerText || !String(body.answerText).trim()) errors.push('主观题 answerText（参考答案）不能为空');
    answerText = String(body.answerText || '').trim();
  }

  return {
    errors,
    data: {
      type,
      stem: String(body.stem || '').trim(),
      options: options ? JSON.stringify(options) : null,
      answer,
      answer_text: answerText,
      analysis: body.analysis ? String(body.analysis).trim() : null,
    },
  };
}

router.get('/questions', (req, res) => {
  const { subjectId, type, keyword } = req.query;
  const where = [];
  const params = [];
  if (subjectId) {
    where.push('q.subject_id = ?');
    params.push(Number(subjectId));
  }
  if (type) {
    where.push('q.type = ?');
    params.push(String(type));
  }
  if (keyword) {
    where.push('q.stem LIKE ?');
    params.push(`%${keyword}%`);
  }
  const sql = `SELECT q.*, s.name AS subject_name FROM questions q JOIN subjects s ON s.id = q.subject_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.id DESC LIMIT 500`;
  const rows = db.prepare(sql).all(...params);
  res.json({
    questions: rows.map((q) => ({ ...q, options: q.options ? JSON.parse(q.options) : null })),
  });
});

router.post('/questions', (req, res) => {
  const { subjectId } = req.body || {};
  if (!subjectId) return res.status(400).json({ error: '缺少科目 subjectId' });
  const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(Number(subjectId));
  if (!subject) return res.status(400).json({ error: '科目不存在' });
  const { errors, data } = validateQuestionPayload(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('；') });
  const r = db
    .prepare('INSERT INTO questions (subject_id, type, stem, options, answer, answer_text, analysis) VALUES (?,?,?,?,?,?,?)')
    .run(Number(subjectId), data.type, data.stem, data.options, data.answer, data.answer_text, data.analysis);
  res.json({ id: Number(r.lastInsertRowid) });
});

router.put('/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '题目不存在' });
  const body = { ...req.body, type: req.body.type || existing.type };
  const { errors, data } = validateQuestionPayload(body);
  if (errors.length) return res.status(400).json({ error: errors.join('；') });
  db.prepare('UPDATE questions SET type=?, stem=?, options=?, answer=?, answer_text=?, analysis=? WHERE id=?').run(
    data.type,
    data.stem,
    data.options,
    data.answer,
    data.answer_text,
    data.analysis,
    id
  );
  res.json({ ok: true });
});

router.delete('/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT COUNT(*) AS c FROM paper_questions WHERE question_id = ?').get(id).c;
  if (used > 0) return res.status(400).json({ error: '该题已被试卷引用，请先从试卷中移除' });
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  res.json({ ok: true });
});

// JSON 批量导入
router.post('/questions/import', (req, res) => {
  const { subjectId, subjectName, questions } = req.body || {};
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: 'questions 不能为空' });

  let subject = null;
  if (subjectId) {
    subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(Number(subjectId));
    if (!subject) return res.status(400).json({ error: '科目不存在' });
  } else if (subjectName) {
    subject = db.prepare('SELECT * FROM subjects WHERE name = ?').get(String(subjectName).trim());
    if (!subject) {
      const r = db.prepare('INSERT INTO subjects (name) VALUES (?)').run(String(subjectName).trim());
      subject = { id: Number(r.lastInsertRowid), name: String(subjectName).trim() };
    }
  } else {
    return res.status(400).json({ error: '需提供 subjectId 或 subjectName' });
  }

  const inserted = [];
  const errors = [];
  const ins = db.prepare(
    'INSERT INTO questions (subject_id, type, stem, options, answer, answer_text, analysis) VALUES (?,?,?,?,?,?,?)'
  );
  questions.forEach((q, i) => {
    const { errors: errs, data } = validateQuestionPayload(q);
    if (errs.length) {
      errors.push({ index: i, stem: String(q.stem || '').slice(0, 30), errors: errs });
      return;
    }
    const r = ins.run(subject.id, data.type, data.stem, data.options, data.answer, data.answer_text, data.analysis);
    inserted.push(Number(r.lastInsertRowid));
  });
  res.json({ insertedCount: inserted.length, insertedIds: inserted, subject: { id: subject.id, name: subject.name }, errors });
});

// ---------- 试卷 ----------
function replacePaperQuestions(paperId, list) {
  db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(paperId);
  const ins = db.prepare('INSERT INTO paper_questions (paper_id, question_id, section, sort, score) VALUES (?,?,?,?,?)');
  const errors = [];
  list.forEach((item, idx) => {
    const q = db.prepare('SELECT id FROM questions WHERE id = ?').get(Number(item.questionId));
    if (!q) {
      errors.push(`第 ${idx + 1} 项：题目 ${item.questionId} 不存在`);
      return;
    }
    const section = String(item.section || '综合知识').trim();
    const score = Number(item.score);
    ins.run(paperId, item.questionId, section, idx, Number.isFinite(score) && score > 0 ? score : 1);
  });
  return errors;
}

function paperDetail(paperId) {
  const paper = db
    .prepare(
      `SELECT p.*, s.name AS subject_name FROM papers p JOIN subjects s ON s.id = p.subject_id WHERE p.id = ?`
    )
    .get(paperId);
  if (!paper) return null;
  const questions = db
    .prepare(
      `SELECT pq.question_id, pq.section, pq.sort, pq.score, q.type, q.stem
      FROM paper_questions pq JOIN questions q ON q.id = pq.question_id
      WHERE pq.paper_id = ?
      ORDER BY pq.sort`
    )
    .all(paperId);
  return { ...paper, questions };
}

router.get('/papers', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, s.name AS subject_name,
        (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count,
        (SELECT COALESCE(SUM(pq.score), 0) FROM paper_questions pq WHERE pq.paper_id = p.id) AS total_score,
        (SELECT COUNT(*) FROM exam_records er WHERE er.paper_id = p.id) AS exam_count
      FROM papers p JOIN subjects s ON s.id = p.subject_id ORDER BY p.id DESC`
    )
    .all();
  res.json({ papers: rows });
});

router.get('/papers/:id', (req, res) => {
  const detail = paperDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: '试卷不存在' });
  res.json({ paper: detail });
});

router.post('/papers', (req, res) => {
  const { subjectId, title, durationMinutes = 150, passScore = 45, questions = [] } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: '试卷标题不能为空' });
  const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(Number(subjectId));
  if (!subject) return res.status(400).json({ error: '科目不存在' });
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: '请至少选择一道题目' });
  const r = db
    .prepare("INSERT INTO papers (subject_id, title, duration_minutes, pass_score, status, created_by) VALUES (?,?,?,?, 'draft', ?)")
    .run(Number(subjectId), String(title).trim(), Math.max(1, Number(durationMinutes) || 150), Number(passScore) || 45, req.user.id);
  const paperId = Number(r.lastInsertRowid);
  const errors = replacePaperQuestions(paperId, questions);
  if (errors.length) {
    db.prepare('DELETE FROM papers WHERE id = ?').run(paperId);
    return res.status(400).json({ error: errors.join('；') });
  }
  res.json({ id: paperId });
});

router.put('/papers/:id', (req, res) => {
  const id = Number(req.params.id);
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(id);
  if (!paper) return res.status(404).json({ error: '试卷不存在' });
  const { title, durationMinutes, passScore, questions } = req.body || {};
  if (title !== undefined) {
    if (!String(title).trim()) return res.status(400).json({ error: '试卷标题不能为空' });
  }
  db.prepare('UPDATE papers SET title = ?, duration_minutes = ?, pass_score = ? WHERE id = ?').run(
    title !== undefined ? String(title).trim() : paper.title,
    durationMinutes !== undefined ? Math.max(1, Number(durationMinutes) || paper.duration_minutes) : paper.duration_minutes,
    passScore !== undefined ? Number(passScore) || paper.pass_score : paper.pass_score,
    id
  );
  if (Array.isArray(questions) && questions.length) {
    const errors = replacePaperQuestions(id, questions);
    if (errors.length) return res.status(400).json({ error: errors.join('；') });
  }
  res.json({ ok: true });
});

router.put('/papers/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['draft', 'published'].includes(status)) return res.status(400).json({ error: 'status 必须是 draft 或 published' });
  if (status === 'published') {
    const count = db.prepare('SELECT COUNT(*) AS c FROM paper_questions WHERE paper_id = ?').get(id).c;
    if (!count) return res.status(400).json({ error: '试卷没有题目，无法发布' });
  }
  db.prepare('UPDATE papers SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

router.delete('/papers/:id', (req, res) => {
  const id = Number(req.params.id);
  const examCount = db.prepare('SELECT COUNT(*) AS c FROM exam_records WHERE paper_id = ?').get(id).c;
  if (examCount > 0) return res.status(400).json({ error: '该试卷已有考试记录，不能删除' });
  db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(id);
  db.prepare('DELETE FROM papers WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- 用户 ----------
router.get('/users', (req, res) => {
  res.json({ users: db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all() });
});

router.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role 必须是 user 或 admin' });
  if (id === req.user.id) return res.status(400).json({ error: '不能修改自己的角色' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ ok: true });
});

export default router;
