// 徽章 API（荣誉殿堂）：列出 / 我的 / 授予(教师&管理员) / 班级矩阵 / 进度 / 批量颁发 / 徽章库 CRUD
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 全部徽章（用于荣誉殿堂展示）
router.get('/list', authMiddleware, async (_req, res) => {
  const rows = await db.prepare(
    'SELECT id, code, name, description, icon, category, threshold, sort_order FROM badge ORDER BY sort_order, id'
  ).all();
  ok(res, rows);
});

// 当前用户已获得的徽章
router.get('/my', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT b.id, b.code, b.name, b.description, b.icon, b.category, b.threshold, ub.earned_at
     FROM user_badge ub JOIN badge b ON ub.badge_id=b.id
     WHERE ub.user_id=? ORDER BY ub.earned_at DESC`
  ).all(req.user.id);
  ok(res, rows);
});

// ── 授予徽章（教师/管理员）──
// POST /api/badge/grant  body: { userId, code }
router.post('/grant', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return fail(res, '缺少 userId 或 code', 400);
  const badge = await db.prepare('SELECT id FROM badge WHERE code=?').get(code);
  if (!badge) return fail(res, '徽章不存在: ' + code, 404);
  const existing = await db.prepare('SELECT id FROM user_badge WHERE user_id=? AND badge_id=?').get(userId, badge.id);
  if (existing) return fail(res, '该用户已获得此徽章', 409);
  await db.prepare('INSERT INTO user_badge (user_id, badge_id) VALUES (?, ?)').run(userId, badge.id);
  recordLog(req.user.id, 'badge_grant', `授予用户${userId}徽章[${code}]`);
  ok(res, { granted: true, badgeCode: code, userId });
});

// ── 撤销徽章（仅管理员）──
router.post('/revoke', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return fail(res, '缺少 userId 或 code', 400);
  const badge = await db.prepare('SELECT id FROM badge WHERE code=?').get(code);
  if (!badge) return fail(res, '徽章不存在', 404);
  await db.prepare('DELETE FROM user_badge WHERE user_id=? AND badge_id=?').run(userId, badge.id);
  recordLog(req.user.id, 'badge_revoke', `撤销用户${userId}徽章[${code}]`);
  ok(res, { revoked: true });
});

// ── 批量颁发（教师/管理员）──
// POST /api/badge/grant-batch  body: { grants: [{ userId, code }] }
router.post('/grant-batch', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { grants } = req.body;
  if (!Array.isArray(grants) || !grants.length) return fail(res, '缺少 grants 数组', 400);
  const results = [];
  let successCount = 0;
  for (const g of grants) {
    const { userId, code } = g || {};
    if (!userId || !code) { results.push({ userId, code, ok: false, reason: '参数缺失' }); continue; }
    const badge = await db.prepare('SELECT id FROM badge WHERE code=?').get(code);
    if (!badge) { results.push({ userId, code, ok: false, reason: '徽章不存在' }); continue; }
    const existing = await db.prepare('SELECT id FROM user_badge WHERE user_id=? AND badge_id=?').get(userId, badge.id);
    if (existing) { results.push({ userId, code, ok: false, reason: '已拥有' }); continue; }
    await db.prepare('INSERT INTO user_badge (user_id, badge_id) VALUES (?, ?)').run(userId, badge.id);
    results.push({ userId, code, ok: true });
    successCount++;
  }
  recordLog(req.user.id, 'badge_grant_batch', `批量颁发 ${grants.length} 项，成功 ${successCount}`);
  ok(res, { results, successCount });
});

// ── 班级徽章矩阵概览（教师/管理员）──
// 返回：students / badges / owned(userId -> [badgeId,...])，驱动学生×徽章矩阵
router.get('/class-overview', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (_req, res) => {
  const students = await db.prepare(
    `SELECT u.id, u.name, s.student_no AS studentNo, u.class_id AS classId
     FROM sys_user u LEFT JOIN student s ON u.student_id = s.id
     WHERE u.role='STUDENT' ORDER BY u.id`
  ).all();
  const badges = await db.prepare(
    'SELECT id, code, name, icon, category, sort_order FROM badge ORDER BY sort_order, id'
  ).all();
  const rows = await db.prepare('SELECT user_id, badge_id FROM user_badge').all();
  const owned = {};
  for (const r of rows) {
    (owned[r.user_id] = owned[r.user_id] || []).push(r.badge_id);
  }
  ok(res, { students, badges, owned });
});

// ── 当前用户徽章进度 + 连续打卡 streak + 热力图（学生/任意登录用户）──
router.get('/progress', authMiddleware, async (req, res) => {
  const uid = req.user.id;
  const totalRow = await db.prepare('SELECT COUNT(*) AS c FROM badge').get();
  const total = totalRow.c;
  const earned = await db.prepare(
    `SELECT b.code, b.name, b.icon, b.category, ub.earned_at
     FROM user_badge ub JOIN badge b ON ub.badge_id=b.id
     WHERE ub.user_id=? ORDER BY ub.earned_at DESC`
  ).all(uid);
  const earnedCount = earned.length;
  const percent = total ? Math.round((earnedCount / total) * 100) : 0;

  // 积分（user_points，按 sys_user.id 关联）
  const pts = await db.prepare('SELECT points, total_earned FROM user_points WHERE user_id=?').get(uid);

  // streak + 热力图：基于 completion_record 的「完成日」
  let streak = 0;
  let heatmap = [];
  const su = await db.prepare('SELECT student_id FROM sys_user WHERE id=?').get(uid);
  if (su && su.student_id) {
    heatmap = await db.prepare(
      `SELECT DATE(completion_time) AS day, COUNT(*) AS cnt
       FROM completion_record
       WHERE student_id=? AND completion_time IS NOT NULL
         AND status IN ('DONE_ONTIME','DONE_OVERDUE')
       GROUP BY DATE(completion_time)
       ORDER BY day DESC LIMIT 200`
    ).all(su.student_id);
    const daySet = new Set(heatmap.map((h) => h.day));
    // 用服务端 CURDATE() 避免 JS 时区偏差（completion_time 由 CURRENT_TIMESTAMP 写入，为服务端时区）
    const t = await db.prepare('SELECT CURDATE() AS today').get();
    let cur = new Date(t.today + 'T00:00:00');
    const fmt = (d) => d.toISOString().slice(0, 10);
    // 今天还没打卡则从昨天起算
    if (!daySet.has(fmt(cur))) cur.setDate(cur.getDate() - 1);
    while (daySet.has(fmt(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
  }

  // 下一个可解锁建议（未获得中按 sort_order 第一个）
  const earnedCodes = new Set(earned.map((e) => e.code));
  const allBadges = await db.prepare(
    'SELECT code, name, category, threshold FROM badge ORDER BY sort_order, id'
  ).all();
  const next = allBadges.find((b) => !earnedCodes.has(b.code)) || null;

  ok(res, {
    total,
    earnedCount,
    percent,
    streak,
    heatmap,
    points: pts?.points || 0,
    totalEarned: pts?.total_earned || 0,
    recent: earned.slice(0, 6),
    next,
  });
});

// ── 授予记录（教师/管理员查看）──
router.get('/grant-logs', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (_req, res) => {
  const rows = await db.prepare(
    `SELECT id, operator_name, operate_type, after_snapshot, create_time
     FROM operate_log
     WHERE operate_type IN ('badge_grant','badge_grant_batch','badge_revoke')
     ORDER BY create_time DESC LIMIT 60`
  ).all();
  ok(res, rows);
});

// ── 徽章库 CRUD（仅管理员）──
// 创建
router.post('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { code, name, description, icon, category, threshold, sort_order } = req.body || {};
  if (!code || !name) return fail(res, '缺少 code 或 name', 400);
  const exist = await db.prepare('SELECT id FROM badge WHERE code=?').get(code);
  if (exist) return fail(res, '徽章 code 已存在: ' + code, 409);
  const r = await db.prepare(
    'INSERT INTO badge (code,name,description,icon,category,threshold,sort_order) VALUES(?,?,?,?,?,?,?)'
  ).run(code, name, description || '', icon || 'Trophy', category || 'STREAK', Number(threshold) || 0, Number(sort_order) || 0);
  recordLog(req.user.id, 'badge_create', `创建徽章[${code}]`);
  ok(res, { id: r.lastInsertRowid });
});

// 更新
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, '无效 id', 400);
  const { name, description, icon, category, threshold, sort_order } = req.body || {};
  await db.prepare(
    'UPDATE badge SET name=?, description=?, icon=?, category=?, threshold=?, sort_order=? WHERE id=?'
  ).run(name, description, icon, category, Number(threshold) || 0, Number(sort_order) || 0, id);
  recordLog(req.user.id, 'badge_update', `更新徽章[${id}]`);
  ok(res, { updated: true });
});

// 删除（同时清理已颁发记录）
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, '无效 id', 400);
  await db.prepare('DELETE FROM user_badge WHERE badge_id=?').run(id);
  await db.prepare('DELETE FROM badge WHERE id=?').run(id);
  recordLog(req.user.id, 'badge_delete', `删除徽章[${id}]`);
  ok(res, { deleted: true });
});

module.exports = router;
