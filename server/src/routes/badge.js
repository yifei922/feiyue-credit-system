// 徽章 API（F2 习惯追踪激励）：列出全部徽章 + 当前用户已获得的徽章
// 轻量版：仅查询 + 标记，不做自动发放（避免引入定时任务）。
// 自动发放可在 routes/completions.js 的 registerCompletion 中按连续天数触发。
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok } = require('../util');
const authMiddleware = require('../middleware/auth');

// 全部徽章（用于徽章墙展示）
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

module.exports = router;