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
const badgeRouter = require('./routes/badge');
const aiAssistantRouter = require('./routes/aiAssistant');
const authMiddleware = require('./middleware/auth');
// 小程序专用路由（社交 + 兴趣资料 + 积分 + 微信登录）
const mpAuthRouter = require('./routes/mp_auth');
const mpFeedRouter = require('./routes/mp_feed');
const mpResourcesRouter = require('./routes/mp_resources');
const mpPointsRouter = require('./routes/mp_points');
const mpProfileRouter = require('./routes/mp_profile');
const mpAdminRouter = require('./routes/mp_admin');
const mpContentRouter = require('./routes/mp_content');
const { init: initDb } = require('./db');

const app = express();

// ── 安全基线（免费）：helmet 设置安全响应头（CSP/X-Frame-Options/HSTS 等）──
// 未安装 helmet 时跳过，避免硬依赖阻断启动；安装后自动生效。
let helmet;
try { helmet = require('helmet'); } catch (_) { /* 未安装时跳过 */ }
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Element Plus / Vite dev 需要 unsafe-inline + unsafe-eval
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
}

app.use(express.json());
// 入参命名归一（契约防御层）：snake_case 别名 → camelCase 兜底
app.use(normalizeBody);

// ── CORS 白名单（免费，自实现）──
app.use(require('./middleware/cors'));

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

// 其余 API 统一鉴权 + 全局限流（免费：120 次/分钟/IP，保护免费层）
let apiLimiter;
try { ({ apiLimiter } = require('./middleware/limiter')); } catch (_) { /* limiter 未安装时跳过 */ }

const api = express.Router();
if (apiLimiter) api.use(apiLimiter);
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
api.use('/badge', badgeRouter);
api.use('/ai', aiAssistantRouter);
// 小程序需要登录的接口（社交 + 兴趣资料 + 积分）
api.use('/mp', mpFeedRouter);
api.use('/mp', mpResourcesRouter);
api.use('/mp', mpPointsRouter);
api.use('/mp', mpProfileRouter);
api.use('/mp', mpAdminRouter);
api.use('/mp', mpContentRouter);
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

// 兴趣资料（兴趣类）由 mp_resources 路由以 /api/mp/resources/file/:filename 提供，
// 仅服务 study-content 下白名单内的 .json 文件，杜绝 K12/中考类 HTML 被公网托管。
// （早期 /study 公开静态目录已被移除：曾无鉴权托管 22 个中小学/中考 HTML，属提审违规。）

// 非 /api 请求回退到 index.html（前端使用 hash 路由，路径恒为 /）
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
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
