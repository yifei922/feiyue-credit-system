// 小程序管理后台通用接口（ADMIN/TEACHER/REP 可用范围见各接口）
// - GET /api/mp/admin/stats        概览数据（资料数/用户数/今日广告解锁/今日查阅）
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');

function today() { return new Date().toISOString().slice(0, 10); }

// 概览
router.get('/admin/stats', async (req, res) => {
  const role = req.user.role;
  if (!['ADMIN', 'TEACHER', 'REP'].includes(role)) return fail(res, 403, '无权查看');
  const resources = await (await db.prepare('SELECT COUNT(*) AS c FROM resource').get()).c;
  const users = await (await db.prepare("SELECT COUNT(*) AS c FROM sys_user WHERE role='STUDENT'").get()).c;
  const todayViews = await (await db.prepare('SELECT COUNT(*) AS c FROM ad_view_log WHERE day=?').get(today())).c;
  const totalPoints = await (await db.prepare('SELECT COALESCE(SUM(points),0) AS s FROM user_points').get()).s;
  ok(res, {
    resources,
    users,
    todayViews,
    totalPoints,
    role,
    isAdmin: role === 'ADMIN' || role === 'TEACHER',
  });
});

module.exports = router;
