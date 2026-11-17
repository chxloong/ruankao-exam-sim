import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(String(username))) {
    return res.status(400).json({ error: '用户名需为 2-20 位字母、数字、下划线或中文' });
  }
  if (String(password).length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(String(password), 10);
  const r = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')").run(username, hash);
  const user = { id: Number(r.lastInsertRowid), username, role: 'user' };
  res.json({ token: signToken(user), user });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  const row = db.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }
  const user = { id: row.id, username: row.username, role: row.role };
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
