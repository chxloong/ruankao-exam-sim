import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import paperRoutes from './routes/papers.js';
import examRoutes from './routes/exams.js';
import myRoutes from './routes/my.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', paperRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/my', myRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '服务器错误' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`软考模拟练习系统 API 已启动: http://localhost:${PORT}`));
