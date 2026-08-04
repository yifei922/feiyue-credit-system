// 课程资料路由（小程序 + Web 后台共用）
// - GET    /api/mp/resources?grade=&subject=&page=         学生浏览
// - GET    /api/mp/resources/:id                          详情（含解锁状态）
// - POST   /api/mp/resources/:id/unlock                   看广告解锁（前端调 wx.ad 后回调）
// - GET    /api/mp/admin/resources                        后台列出（ADMIN/TEACHER）
// - POST   /api/mp/admin/resources                        后台新增
// - PUT    /api/mp/admin/resources/:id                    后台更新
// - DELETE /api/mp/admin/resources/:id                    后台删除
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');

const FREE_DAILY_QUOTA = 3;          // 每天免费查看次数
const AD_UNLOCK_DAILY_LIMIT = 20;    // 每天最多广告解锁次数（防刷）

function today() { return new Date().toISOString().slice(0, 10); }
function isAdmin(u) { return u && (u.role === 'ADMIN' || u.role === 'TEACHER'); }

// ── 学生端 ──

// 列表：按年级+科目筛选
router.get('/resources', (req, res) => {
  const { grade, subject, page = 1 } = req.query;
  const lim = 20, off = (Math.max(1, +page) - 1) * lim;
  const where = [];
  const args = [];
  if (grade) { where.push('grade=?'); args.push(grade); }
  if (subject) { where.push('subject=?'); args.push(subject); }
  const sql = `SELECT id, grade, subject, title, cover, type, description, source, tags, view_count, unlock_count
               FROM resource ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?`;
  const list = db.prepare(sql).all(...args, lim, off);
  // 解析 tags JSON
  list.forEach((r) => { try { r.tags = JSON.parse(r.tags || '[]'); } catch (_) { r.tags = []; } });
  ok(res, { list, hasMore: list.length === lim });
});

// 详情：返回 url + 解锁状态
router.get('/resources/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT * FROM resource WHERE id=?').get(id);
  if (!r) return fail(res, 404, '资料不存在');
  try { r.tags = JSON.parse(r.tags || '[]'); } catch (_) { r.tags = []; }

  // 今日免费次数
  const u = req.user;
  const dv = db.prepare('SELECT view_count FROM user_daily_view WHERE user_id=? AND day=?')
    .get(u.id, today());
  const usedFree = dv ? dv.view_count : 0;
  const freeLeft = Math.max(0, FREE_DAILY_QUOTA - usedFree);

  // 是否已看过（不算解锁，仅免费配额）
  const unlocksToday = db.prepare(`SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND resource_id=? AND day=?`)
    .get(u.id, id, today()).c;

  // url 仅在 freeLeft > 0 或已解锁时返回
  const accessible = freeLeft > 0;
  if (!accessible) {
    delete r.url; // 不返回 url，让前端弹广告
  } else {
    // 增加免费配额计数 + 资源总查看数
    db.prepare(`INSERT INTO user_daily_view(user_id, day, view_count) VALUES(?,?,1)
                ON CONFLICT(user_id, day) DO UPDATE SET view_count = view_count + 1`).run(u.id, today());
    db.prepare('UPDATE resource SET view_count = view_count + 1 WHERE id=?').run(id);
  }
  ok(res, {
    resource: r,
    freeQuota: { used: usedFree + (accessible ? 1 : 0), total: FREE_DAILY_QUOTA, left: accessible ? freeLeft - 1 : 0 },
    requiresAd: !accessible,
    adUnlocksToday: unlocksToday,
    adUnlockDailyLimit: AD_UNLOCK_DAILY_LIMIT,
  });
});

// 解锁（前端看完激励视频广告后回调）
router.post('/resources/:id/unlock', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT id FROM resource WHERE id=?').get(id);
  if (!r) return fail(res, 404, '资料不存在');
  const u = req.user;
  const day = today();
  const used = db.prepare(`SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND day=?`).get(u.id, day).c;
  if (used >= AD_UNLOCK_DAILY_LIMIT) {
    return fail(res, 429, `今日广告解锁已达上限 ${AD_UNLOCK_DAILY_LIMIT} 次，明天再来`);
  }
  // 记录 + 返回 url
  db.prepare('INSERT INTO ad_view_log(user_id, resource_id, day) VALUES(?,?,?)').run(u.id, id, day);
  db.prepare('UPDATE resource SET unlock_count = unlock_count + 1 WHERE id=?').run(id);
  const full = db.prepare('SELECT id, url, type, title FROM resource WHERE id=?').get(id);
  ok(res, { url: full.url, type: full.type, title: full.title, unlocked: true });
});

// ── 后台管理（ADMIN/TEACHER）──
router.get('/admin/resources', (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const { grade, subject } = req.query;
  const where = []; const args = [];
  if (grade) { where.push('grade=?'); args.push(grade); }
  if (subject) { where.push('subject=?'); args.push(subject); }
  const list = db.prepare(`SELECT * FROM resource ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                           ORDER BY grade, subject, sort_order ASC, id DESC`).all(...args);
  list.forEach((r) => { try { r.tags = JSON.parse(r.tags || '[]'); } catch (_) { r.tags = []; } });
  ok(res, { list });
});

router.post('/admin/resources', (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const { grade, subject, title, cover, type, url, description, source, tags, sort_order } = req.body || {};
  if (!grade || !subject || !title || !type || !url) return fail(res, 400, '缺少必填字段');
  const info = db.prepare(`INSERT INTO resource(grade, subject, title, cover, type, url, description, source, tags, sort_order, created_by)
                           VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(grade, subject, title, cover || null, type, url, description || null,
         source || null, JSON.stringify(tags || []), +sort_order || 0, req.user.id);
  ok(res, { id: info.lastInsertRowid });
});

router.put('/admin/resources/:id', (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT id FROM resource WHERE id=?').get(id);
  if (!cur) return fail(res, 404, '资料不存在');
  const { grade, subject, title, cover, type, url, description, source, tags, sort_order } = req.body || {};
  db.prepare(`UPDATE resource SET grade=?, subject=?, title=?, cover=?, type=?, url=?, description=?, source=?, tags=?, sort_order=? WHERE id=?`)
    .run(grade, subject, title, cover || null, type, url, description || null,
         source || null, JSON.stringify(tags || []), +sort_order || 0, id);
  ok(res, { ok: true });
});

router.delete('/admin/resources/:id', (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  db.prepare('DELETE FROM resource WHERE id=?').run(Number(req.params.id));
  ok(res, { ok: true });
});

module.exports = router;