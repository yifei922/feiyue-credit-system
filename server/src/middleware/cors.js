// CORS 白名单中间件（免费，无需额外依赖）
// 设计权衡：避免引入 cors 包（节省 50KB），自实现足够覆盖本项目场景。
// 允许的来源：本地开发、onrender 默认域、自定义域、微信小程序 web-view、无 Origin。
const ALLOW_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,                    // 本地开发
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,                 // 本地回环
  /^https?:\/\/[\w-]+\.onrender\.com$/,               // onrender 默认/预览域
  /^https?:\/\/[\w-]+-credit\.onrender\.com$/,        // 兼容旧子域
  /^https?:\/\/servicewechat\.com$/,                  // 微信小程序 web-view
  /^https?:\/\/mp\.weixin\.qq\.com$/,                 // 微信公众号
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // 同源 / 服务端直连 / 移动端 native 调用
  return ALLOW_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,DELETE,OPTIONS,PATCH'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-Requested-With'
    );
    res.setHeader('Access-Control-Max-Age', '600');
  }
  // 预检请求直接 204
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

module.exports = corsMiddleware;