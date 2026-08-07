// 小程序个人资料维护（当前登录用户自助修改）
// - POST /api/mp/profile  { name?, studentId?, avatar? }
//   更新姓名 / 学号 / 头像，便于后台管理识别；字段缺失则不更新
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');

router.post('/profile', async (req, res) => {
  const u = req.user;
  const { name, studentId, avatar } = req.body || {};
  const sets = [];
  const args = [];
  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length === 0 || n.length > 20) return fail(res, 400, '姓名长度需在 1–20 之间');
    sets.push('name=?'); args.push(n);
  }
  if (studentId !== undefined) {
    sets.push('student_id=?'); args.push(studentId === '' || studentId == null ? null : Number(studentId));
  }
  if (avatar !== undefined) {
    sets.push('avatar=?'); args.push(avatar || null);
  }
  if (sets.length === 0) return fail(res, 400, '没有要更新的字段');
  args.push(u.id);
  await db.prepare('UPDATE sys_user SET ' + sets.join(', ') + ' WHERE id=?').run(...args);
  const row = await db.prepare('SELECT id, username, name, role, student_id, avatar FROM sys_user WHERE id=?').get(u.id);
  ok(res, { id: row.id, name: row.name, studentId: row.student_id, avatar: row.avatar, role: row.role });
});

module.exports = router;
