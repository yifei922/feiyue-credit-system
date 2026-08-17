// 徽章 API（荣誉殿堂）：列出 / 我的 / 授予(教师&管理员)
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
  // 查找徽章定义
  const badge = await db.prepare('SELECT id FROM badge WHERE code=?').get(code);
  if (!badge) return fail(res, '徽章不存在: ' + code, 404);
  // 检查是否已拥有
  const existing = await db.prepare('SELECT id FROM user_badge WHERE user_id=? AND badge_id=?').get(userId, badge.id);
  if (existing) return fail(res, '该用户已获得此徽章', 409);
  // 授予
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

module.exports = router;