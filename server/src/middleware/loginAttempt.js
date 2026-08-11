// 登录失败计数（内存版，免费）：同账号+IP 多次失败后临时锁定
// 设计权衡：免费层无 Redis，使用进程内 Map。进程重启会清零（不致命，仅增加攻击成本）。
// 后续如需持久化，平滑切换到 MySQL/Redis 即可，无需改调用方。
const { fail } = require('../util');

const MAX_FAILS = 5;                     // 5 次失败即锁
const LOCK_MS = 15 * 60 * 1000;          // 锁定 15 分钟
const MAX_STORE = 5000;                  // 内存键上限，超过触发清理

// key = `${username.toLowerCase()}|${ip}` -> { fails, lockedUntil }
const store = new Map();

function keyOf(username, ip) {
  return `${String(username || '').toLowerCase()}|${ip}`;
}

function isLocked(username, ip) {
  const k = keyOf(username, ip);
  const rec = store.get(k);
  if (!rec) return null;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return rec;
  // 已过期则清理
  if (rec.lockedUntil) store.delete(k);
  return null;
}

function recordFail(username, ip) {
  const k = keyOf(username, ip);
  const rec = store.get(k) || { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) rec.lockedUntil = Date.now() + LOCK_MS;
  store.set(k, rec);
  // 超过上限时清理已过期键，防止内存泄漏
  if (store.size > MAX_STORE) {
    const now = Date.now();
    for (const [kk, r] of store) {
      if (!r.lockedUntil || r.lockedUntil <= now) store.delete(kk);
    }
  }
  return rec;
}

function clearOnSuccess(username, ip) {
  store.delete(keyOf(username, ip));
}

/**
 * 登录前置守卫：检查失败计数，超限直接 429。
 * 调用方（auth.js /login）成功时调 clearLoginAttempts，失败时调 recordLoginFail。
 */
function loginAttemptGuard(req, res, next) {
  const username = String(req.body?.username || '').trim();
  if (!username) return next();
  const ip = req.ip;
  const locked = isLocked(username, ip);
  if (locked) {
    const retryAfterSec = Math.ceil((locked.lockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return fail(res, 429, `登录失败次数过多，请 ${Math.ceil(retryAfterSec / 60)} 分钟后重试`);
  }
  next();
}

module.exports = {
  loginAttemptGuard,
  recordLoginFail: recordFail,
  clearLoginAttempts: clearOnSuccess,
};