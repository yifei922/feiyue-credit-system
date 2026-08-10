// 本地纯 Node 部署时加载 server/.env（Docker 环境由 compose 注入，此行为空操作）
try { require('dotenv').config(); } catch (_) { /* dotenv 未安装时跳过 */ }
const express = require('express');
const path = require('path');
const { normalizeBody } = require('./middleware/normalize');
const authRouter = require('./routes/auth');
const studentsRouter = require('./routes/students');
const subjectsRouter = require('./routes/subjects');
const tasksRouter = require('./routes/tasks');
const completionsRouter = require('./routes/completions');
const uploadsRouter = require('./routes/uploads');
const creditFlowRouter = require('./routes/creditFlow');
const alertsRouter = require('./routes/alerts');
const recommendRouter = require('./routes/recommend');
const dashboardRouter = require('./routes/dashboard');
const operateLogRouter = require('./routes/operateLog');
const usersRouter = require('./routes/users');
const authMiddleware = require('./middleware/auth');
// 小程序专用路由（社交 + 课程资料 + 积分 + 微信登录）
const mpAuthRouter = require('./routes/mp_auth');
const mpFeedRouter = require('./routes/mp_feed');
const mpResourcesRouter = require('./routes/mp_resources');
const mpPointsRouter = require('./routes/mp_points');
const mpProfileRouter = require('./routes/mp_profile');
const mpAdminRouter = require('./routes/mp_admin');
const { init: initDb } = require('./db');

const app = express();
app.use(express.json());
// 入参命名归一（契约防御层）：snake_case 别名 → camelCase 兜底
app.use(normalizeBody);

// ── 健康检查（供 Render + 保活服务使用，无需鉴权，最快响应）──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── 限制 sharp/libvips 线程数：免费层 0.1 CPU 跑 1-2 个 libvips 线程最优，避免线程切换浪费 ──
try {
  const sharp = require('sharp');
  sharp.concurrency(2);
  sharp.cache(false); // 进程级缓存关闭，省内存（上传走完后下次重新加载即可）
} catch (_) { /* sharp 未安装时跳过 */ }

// 认证路由：login 公开；/me 自带鉴权
app.use('/api/auth', authRouter);

// 小程序微信登录：公开端点（拿 code 换 openid 不能要求登录），单独挂载绕过 authMiddleware
app.use('/api/mp/auth', mpAuthRouter);

// 其余 API 统一鉴权
const api = express.Router();
api.use(authMiddleware);
api.use('/students', studentsRouter);
api.use('/subjects', subjectsRouter);
api.use('/tasks', tasksRouter);
api.use('/completion', completionsRouter);
api.use('/uploads', uploadsRouter);
api.use('/credit-flow', creditFlowRouter);
api.use('/alerts', alertsRouter);
api.use('/recommend', recommendRouter);
api.use('/dashboard', dashboardRouter);
api.use('/operate-logs', operateLogRouter);
api.use('/users', usersRouter);
// 小程序需要登录的接口（社交 + 课程资料 + 积分）
api.use('/mp', mpFeedRouter);
api.use('/mp', mpResourcesRouter);
api.use('/mp', mpPointsRouter);
api.use('/mp', mpProfileRouter);
api.use('/mp', mpAdminRouter);
app.use('/api', api);

// ── /api 路径未匹配 → 返回 JSON 404（而非 HTML）──
app.use('/api', (_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

// ── 全局错误中间件（防止异常返回 HTML 堆栈）──
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : (err.message || '服务器错误'),
  });
});

// 同源托管前端（单进程全栈，部署到免费平台只需这一个服务）
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(DIST));

// 课程资料静态托管（自托管复习资料 HTML，供小程序复制链接后在浏览器打开）
// url 在库中存为相对路径 /study/<id>.html，小程序端会自动拼接后端域名
const STUDY_DIR = path.join(__dirname, '..', 'study-content');
app.use('/study', express.static(STUDY_DIR));

// 非 /api 请求回退到 index.html（前端使用 hash 路由，路径恒为 /）
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  // /study 下缺失的资料文件返回 404，而非兜底返回首页（避免复制失效链接却打开首页）
  if (req.path.startsWith('/study')) return res.status(404).send('资料不存在');
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;

// ── 全局异步兜底：未捕获的 Promise 拒绝与未捕获异常必须记录并安全退出 ──
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason, '\n  at:', promise);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] 进程即将退出:', err);
  // 短暂延迟确保日志落盘
  setTimeout(() => process.exit(1), 500);
});

// 启动前必须完成数据库初始化（建表 + 种子 + 迁移），否则路由会用到尚未建好的表
(async () => {
  try {
    await initDb();
  } catch (e) {
    console.error('[db] 初始化失败，服务启动中止：', e);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`[server] 点滴进步积分系统已启动: http://localhost:${PORT}`);
  });
})();
