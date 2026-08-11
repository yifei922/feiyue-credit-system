const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { hashPassword } = require('../auth');
const { ROLE_LABEL, genTempPwd } = require('../constants');
const { ok, fail, paginate, setPageHeaders } = require('../util');
const { requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 账号列表（管理员/主理人）：含角色、姓名、编号、负责兴趣分类（分页；数组主体 + 响应头元信息）
router.get('/', requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const role = req.query.role;
  const params = [];
  let where = '1=1';
  if (role) { where += ' AND u.role=?'; params.push(role); }
  const total = (await db.prepare(`SELECT COUNT(*) AS c FROM sys_user u WHERE ${where}`).get(...params)).c;
  const sql = `SELECT u.id, u.username, u.name, u.role, u.student_id AS studentId, s.student_no AS studentNo
             FROM sys_user u LEFT JOIN student s ON u.student_id=s.id WHERE ${where}
             ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'TEACHER' THEN 1 WHEN 'REP' THEN 2 ELSE 3 END, u.id
             LIMIT ? OFFSET ?`;
  const rows = await db.prepare(sql).all(...params, pageSize, offset);
  const list = await Promise.all(rows.map(async (u) => {
    const subs = await db.prepare(
      `SELECT sub.id, sub.name FROM subject_rep sr JOIN subject sub ON sr.subject_id=sub.id WHERE sr.user_id=?`
    ).all(u.id);
    return {
      id: u.id, username: u.username, name: u.name, role: u.role, roleLabel: ROLE_LABEL[u.role] || u.role,
      studentId: u.studentId, studentNo: u.studentNo,
      subjectIds: await Promise.all(subs.map(async (s) => s.id)), subjectNames: await Promise.all(subs.map(async (s) => s.name))
    };
  }));
  const hasMore = offset + rows.length < total;
  setPageHeaders(res, { total, page, pageSize, hasMore });
  ok(res, list);
});

// 重置/设定密码（管理员/主理人/小组长）
// 安全加固：不传 password 时生成 10 位随机临时密码（前端一次性展示，要求首次登录强制改密）。
// 不再使用 '123456' 默认密码（弱密码风险）。
router.post('/:id/reset-password', requireRole('ADMIN', 'TEACHER', 'REP'), async (req, res) => {
  const target = await db.prepare('SELECT * FROM sys_user WHERE id=?').get(req.params.id);
  if (!target) return fail(res, 404, '账号不存在');
  if (req.user.role === 'REP' && target.role !== 'STUDENT') {
    return fail(res, 403, '小组长只能重置成员的密码');
  }
  if (target.username === 'superadmin' && req.user.username !== 'superadmin') {
    return fail(res, 403, '超级管理员密码只能由本人修改');
  }
  // 仅超级管理员可自定义密码；其他人一律生成随机临时密码
  const customPwd = String(req.body?.password || '').trim();
  const newPwd = (customPwd && req.user.username === 'superadmin') ? customPwd : genTempPwd();
  if (newPwd.length < 8) return fail(res, 400, '密码至少 8 位');
  await db.prepare('UPDATE sys_user SET password=?, must_change_pwd=1 WHERE id=?').run(hashPassword(newPwd), target.id);
  recordLog(req.user, 'UPDATE', 'sys_user', target.id, { username: target.username }, { action: 'reset-password' });
  // 注意：返回明文密码仅供调用方一次性展示给被重置用户；不应长期存储。
  ok(res, { ok: true, username: target.username, password: newPwd, mustChangePwd: true });
});

// 设置角色 + 小组长兴趣分类绑定（仅 ADMIN）
// 安全加固：主理人拥有大量成员/家长账号时易失控；只允许超级管理员变更角色。
router.post('/:id/role', requireRole('ADMIN'), async (req, res) => {
  const target = await db.prepare('SELECT * FROM sys_user WHERE id=?').get(req.params.id);
  if (!target) return fail(res, 404, '账号不存在');
  const { role, subjectIds } = req.body || {};
  const validRoles = ['ADMIN', 'TEACHER', 'REP', 'STUDENT'];
  if (!validRoles.includes(role)) return fail(res, 400, '角色非法');
  // 仅超级管理员可变更角色（含授予 ADMIN），防止普通 ADMIN 横向提权
  if (req.user.username !== 'superadmin') return fail(res, 403, '仅超级管理员可变更角色');
  if (target.username === 'superadmin') return fail(res, 403, '不能修改超级管理员的角色');

  await db.prepare('UPDATE sys_user SET role=? WHERE id=?').run(role, target.id);
  // 维护小组长兴趣分类映射
  await db.prepare('DELETE FROM subject_rep WHERE user_id=?').run(target.id);
  if (role === 'REP' && Array.isArray(subjectIds)) {
    const ins = await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)');
    for (const sid of subjectIds.map(Number)) {
      await ins.run(sid, target.id);
    }
  }
  recordLog(req.user, 'UPDATE', 'sys_user', target.id, { role: target.role }, { role, subjectIds });
  ok(res, { ok: true, role, subjectIds: role === 'REP' ? (subjectIds || []) : [] });
});

module.exports = router;
