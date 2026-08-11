// 全局 API 限流（免费）：保护免费层实例不被滥用
// 默认 120 次/分钟/IP；上传单独更严格（20 次/分钟/IP）。
// 登录接口由 loginAttemptGuard 提供更精细的账号+IP 维度锁定。
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '上传过于频繁，请稍后再试' },
});

module.exports = { apiLimiter, uploadLimiter };