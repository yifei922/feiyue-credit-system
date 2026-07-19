// 鉴权中间件：校验 Bearer Token，注入 req.user
const { verifyToken } = require('../auth');
const { fail } = require('../util');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 401, '未登录');
  try {
    req.user = verifyToken(token);
    next();
  } catch (e) {
    return fail(res, 401, '登录已过期，请重新登录');
  }
}

module.exports = authMiddleware;
