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

const VIEW_COST_POINTS = Number(process.env.RESOURCE_VIEW_COST) || 5; // 每次查阅/下载扣除积分
const AD_DAILY_LIMIT = 20;              // 每天最多看广告解锁次数（防刷）

function today() { return new Date().toISOString().slice(0, 10); }
function isAdmin(u) { return u && (u.role === 'ADMIN' || u.role === 'TEACHER'); }
function safeTags(t) { try { return JSON.parse(t || '[]'); } catch (_) { return []; } }
async function watchedAdToday(uid, rid) {
  return await db.prepare('SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND resource_id=? AND day=?')
    .get(uid, rid, today()).c > 0;
}
async function balanceOf(uid) {
  const r = await db.prepare('SELECT points FROM user_points WHERE user_id=?').get(uid);
  return r ? r.points : 0;
}

// ── 学生端 ──

// 列表：按年级+科目筛选
router.get('/resources', async (req, res) => {
  const { grade, subject, page = 1 } = req.query;
  const lim = 20, off = (Math.max(1, +page) - 1) * lim;
  const where = [];
  const args = [];
  if (grade) { where.push('grade=?'); args.push(grade); }
  if (subject) { where.push('subject=?'); args.push(subject); }
  const sql = `SELECT id, grade, subject, title, cover, type, description, source, tags, view_count, unlock_count
               FROM resource ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?`;
  const list = await db.prepare(sql).all(...args, lim, off);
  list.forEach((r) => { r.tags = safeTags(r.tags); });
  ok(res, { list, hasMore: list.length === lim, viewCostPoints: VIEW_COST_POINTS });
});

// 详情：返回是否需看广告、积分是否足够等元信息（url 仅当天已看广告后才返回）
// 付费墙策略（可配置，默认「汇编免费、外链资料收费」）：
//   RESOURCE_CONTENT_GATED=1 时，连「汇编本身」也需在看过广告且积分充足后才返回；
//   =0（默认）时，结构化汇编(content)免费展示，仅外链原文件(url)走广告+积分门槛。
router.get('/resources/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.prepare('SELECT * FROM resource WHERE id=?').get(id);
  if (!r) return fail(res, 404, '资料不存在');

  const uid = req.user.id;
  const adWatched = await watchedAdToday(uid, id);
  const balance = await balanceOf(uid);
  const contentGated = process.env.RESOURCE_CONTENT_GATED === '1';
  // 解析结构化内容（供小程序内联展示）
  let parsedContent = null;
  if (r.content) { try { parsedContent = JSON.parse(r.content); } catch (_) {} }

  // 汇编内容是否对本用户可见：
  //   - 非门控模式(默认)：始终免费可见
  //   - 门控模式：需看过广告且积分足够
  const contentVisible = !contentGated || (adWatched && balance >= VIEW_COST_POINTS);

  const out = {
    id: r.id, grade: r.grade, subject: r.subject, title: r.title, cover: r.cover,
    type: r.type, description: r.description, source: r.source, view_count: r.view_count,
    tags: safeTags(r.tags),
    requiresAd: !adWatched,
    pointsCost: VIEW_COST_POINTS,
    pointsBalance: balance,
    canView: balance >= VIEW_COST_POINTS,
    contentGated,                       // 汇编内容是否受付费墙限制
    contentVisible,                     // 当前用户能否看到汇编内容
    externalGated: true,                // 外链原文件始终需广告+积分
    content: contentVisible ? parsedContent : null,  // 受 contentGated 约束
  };
  if (adWatched) out.url = r.url;    // 当天看过广告 → 可直接查阅（但仍会扣积分）
  ok(res, { resource: out, adDailyLimit: AD_DAILY_LIMIT });
});

// 前端看完激励视频广告后回调：记录广告观看（当天该资源只记一次）
router.post('/resources/:id/ad-done', async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.prepare('SELECT id FROM resource WHERE id=?').get(id)) return fail(res, 404, '资料不存在');
  const uid = req.user.id, day = today();
  const used = await (await db.prepare('SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND resource_id IS NULL AND day=?').get(uid, day)).c;
  // 注意：此处只统计 resource_id IS NULL 的「每日广告奖励」计数，避免与资料解锁计数冲突
  const adCount = await (await db.prepare('SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND day=?').get(uid, day)).c;
  if (adCount >= AD_DAILY_LIMIT) return fail(res, 429, `今日广告解锁已达上限 ${AD_DAILY_LIMIT} 次，明天再来`);
  if (!watchedAdToday(uid, id)) {
    await db.prepare('INSERT INTO ad_view_log(user_id, resource_id, day) VALUES(?,?,?)').run(uid, id, day);
    await db.prepare('UPDATE resource SET unlock_count = unlock_count + 1 WHERE id=?').run(id);
  }
  ok(res, { ok: true, requiresAd: false });
});

// 实际查阅/下载：校验当天已看广告，并扣积分后返回 url
router.post('/resources/:id/access', async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.prepare('SELECT * FROM resource WHERE id=?').get(id);
  if (!r) return fail(res, 404, '资料不存在');
  const uid = req.user.id;
  if (!watchedAdToday(uid, id)) return fail(res, 425, '请先看完广告再查看资料');
  const balance = balanceOf(uid);
  if (balance < VIEW_COST_POINTS) {
    return fail(res, 402, `积分不足，查阅需 ${VIEW_COST_POINTS} 积分（当前 ${balance}）。去看广告或完成任务赚积分吧`);
  }
  // 扣积分
  const cur = await db.prepare('SELECT points, total_earned FROM user_points WHERE user_id=?').get(uid);
  if (cur) {
    await db.prepare("UPDATE user_points SET points=points-?, updated_at=NOW() WHERE user_id=?")
      .run(VIEW_COST_POINTS, uid);
  } else {
    await db.prepare('INSERT INTO user_points(user_id, points, total_earned) VALUES(?,?,0)')
      .run(uid, -VIEW_COST_POINTS);
  }
  await db.prepare('UPDATE resource SET view_count = view_count + 1 WHERE id=?').run(id);
  ok(res, { url: r.url, type: r.type, title: r.title, pointsLeft: balance - VIEW_COST_POINTS });
});

// ── 后台管理（ADMIN/TEACHER）──
router.get('/admin/resources', async (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const { grade, subject } = req.query;
  const where = []; const args = [];
  if (grade) { where.push('grade=?'); args.push(grade); }
  if (subject) { where.push('subject=?'); args.push(subject); }
  const list = await db.prepare(`SELECT * FROM resource ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                           ORDER BY grade, subject, sort_order ASC, id DESC`).all(...args);
  list.forEach((r) => { try { r.tags = JSON.parse(r.tags || '[]'); } catch (_) { r.tags = []; } });
  ok(res, { list });
});

router.post('/admin/resources', async (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const { grade, subject, title, cover, type, url, description, source, tags, sort_order } = req.body || {};
  if (!grade || !subject || !title || !type || !url) return fail(res, 400, '缺少必填字段');
  const info = await db.prepare(`INSERT INTO resource(grade, subject, title, cover, type, url, description, source, tags, sort_order, created_by)
                           VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(grade, subject, title, cover || null, type, url, description || null,
         source || null, JSON.stringify(tags || []), +sort_order || 0, req.user.id);
  ok(res, { id: info.lastInsertRowid });
});

router.put('/admin/resources/:id', async (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const id = Number(req.params.id);
  const cur = await db.prepare('SELECT id FROM resource WHERE id=?').get(id);
  if (!cur) return fail(res, 404, '资料不存在');
  const { grade, subject, title, cover, type, url, description, source, tags, sort_order } = req.body || {};
  await db.prepare(`UPDATE resource SET grade=?, subject=?, title=?, cover=?, type=?, url=?, description=?, source=?, tags=?, sort_order=? WHERE id=?`)
    .run(grade, subject, title, cover || null, type, url, description || null,
         source || null, JSON.stringify(tags || []), +sort_order || 0, id);
  ok(res, { ok: true });
});

router.delete('/admin/resources/:id', async (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  await db.prepare('DELETE FROM resource WHERE id=?').run(Number(req.params.id));
  ok(res, { ok: true });
});

// 批量导入（教师/管理员一次性录入多条；支持 JSON 数组）
router.post('/admin/resources/batch', async (req, res) => {
  if (!isAdmin(req.user)) return fail(res, 403, '无权操作');
  const list = Array.isArray(req.body?.list) ? req.body.list : [];
  if (list.length === 0) return fail(res, 400, 'list 不能为空');
  if (list.length > 500) return fail(res, 400, '单次最多 500 条');
  const insert = await db.prepare(`INSERT INTO resource(grade, subject, title, type, url, description, source, tags, sort_order, created_by)
                             VALUES(?,?,?,?,?,?,?,?,?,?)`);
  let inserted = 0, skipped = 0;
  const errors = [];
  const tx = db.transaction((items) => {
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      if (!r.grade || !r.subject || !r.title || !r.type || !r.url) {
        skipped++; errors.push(`#${i+1}: 缺少必填字段`); continue;
      }
      try {
        insert.run(r.grade, r.subject, r.title, r.type, r.url,
          r.description || null, r.source || null,
          JSON.stringify(r.tags || []), +r.sort_order || 0, req.user.id);
        inserted++;
      } catch (e) { skipped++; errors.push(`#${i+1}: ${e.message}`); }
    }
  });
  try { tx(list); } catch (e) { return fail(res, 500, e.message); }
  ok(res, { inserted, skipped, total: list.length, errors: errors.slice(0, 10) });
});

module.exports = router;