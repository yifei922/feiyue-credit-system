const express = require('express');
const path = require('path');
const authRouter = require('./routes/auth');
const studentsRouter = require('./routes/students');
const subjectsRouter = require('./routes/subjects');
const tasksRouter = require('./routes/tasks');
const completionsRouter = require('./routes/completions');
const creditFlowRouter = require('./routes/creditFlow');
const alertsRouter = require('./routes/alerts');
const recommendRouter = require('./routes/recommend');
const dashboardRouter = require('./routes/dashboard');
const operateLogRouter = require('./routes/operateLog');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(express.json());

// 认证路由：login 公开；/me 自带鉴权
app.use('/api/auth', authRouter);

// 其余 API 统一鉴权
const api = express.Router();
api.use(authMiddleware);
api.use('/students', studentsRouter);
api.use('/subjects', subjectsRouter);
api.use('/tasks', tasksRouter);
api.use('/completion', completionsRouter);
api.use('/credit-flow', creditFlowRouter);
api.use('/alerts', alertsRouter);
api.use('/recommend', recommendRouter);
api.use('/dashboard', dashboardRouter);
api.use('/operate-logs', operateLogRouter);
app.use('/api', api);

// 同源托管前端（单进程全栈，部署到免费平台只需这一个服务）
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(DIST));

// 非 /api 请求回退到 index.html（前端使用 hash 路由，路径恒为 /）
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] 斐越十班学分系统已启动: http://localhost:${PORT}`);
});
