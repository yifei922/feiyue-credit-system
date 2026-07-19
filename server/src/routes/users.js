const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { hashPassword } = require('../auth');
const { ok, fail } = require('../util');
const { requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

const ROLE_LABEL = { ADMIN: '管理员', TEACHER: '老师', REP: '课代表', STUDENT: '学生' };

// 账号列表（管理员/老师）：含角色、姓名、学号、负责科目
router.get('/', requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const role = req.query.role;
  let sql = `SELECT u.id, u.username, u.name, u.role, u.student_id AS studentId, s.student_no AS studentNo
             FROM sys_user u LEFT JOIN student s ON u.student_id=s.id WHERE 1=1`;
  const params = [];
  if (role) { sql += ' AND u.role=?'; params.push(role); }
  sql += " ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'TEACHER' THEN 1 WHEN 'REP' THEN 2 ELSE 3 END, u.id";
  const rows = db.prepare(sql).all(...params);
  const result = rows.map((u) => {
    const subs = db.prepare(
      `SELECT sub.id, sub.name FROM subject_rep sr JOIN subject sub ON sr.subject_id=sub.id WHERE sr.user_id=?`
    ).all(u.id);
    return {
      id: u.id, username: u.username, name: u.name, role: u.role, roleLabel: ROLE_LABEL[u.role] || u.role,
      studentId: u.studentId, studentNo: u.studentNo,
      subjectIds: subs.map((s) => s.id), subjectNames: subs.map((s) => s.name)
    };
  });
  ok(res, result);
});

// 重置/设定密码（管理员/老师/课代表）
// body: { password?: '自定义密码，不传则重置为 123456' }
// 课代表仅能重置「学生」账号；不允许任何人重置超级管理员
router.post('/:id/reset-password', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const target = db.prepare('SELECT * FROM sys_user WHERE id=?').get(req.params.id);
  if (!target) return fail(res, 404, '账号不存在');
  if (req.user.role === 'REP' && target.role !== 'STUDENT') {
    return fail(res, 403, '课代表只能重置学生的密码');
  }
  if (target.username === 'superadmin' && req.user.username !== 'superadmin') {
    return fail(res, 403, '超级管理员密码只能由本人修改');
  }
  const newPwd = String(req.body?.password || '').trim() || '123456';
  if (newPwd.length < 4) return fail(res, 400, '密码至少 4 位');
  db.prepare('UPDATE sys_user SET password=? WHERE id=?').run(hashPassword(newPwd), target.id);
  recordLog(req.user, 'UPDATE', 'sys_user', target.id, { username: target.username }, { action: 'reset-password' });
  ok(res, { ok: true, username: target.username, password: newPwd });
});

// 设置角色 + 课代表科目绑定（管理员/老师）
// body: { role: 'REP'|'STUDENT'|'TEACHER'|'ADMIN', subjectIds?: number[] }
router.post('/:id/role', requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const target = db.prepare('SELECT * FROM sys_user WHERE id=?').get(req.params.id);
  if (!target) return fail(res, 404, '账号不存在');
  const { role, subjectIds } = req.body || {};
  const validRoles = ['ADMIN', 'TEACHER', 'REP', 'STUDENT'];
  if (!validRoles.includes(role)) return fail(res, 400, '角色非法');
  if (target.username === 'superadmin') return fail(res, 403, '不能修改超级管理员的角色');

  db.prepare('UPDATE sys_user SET role=? WHERE id=?').run(role, target.id);
  // 维护课代表科目映射
  db.prepare('DELETE FROM subject_rep WHERE user_id=?').run(target.id);
  if (role === 'REP' && Array.isArray(subjectIds)) {
    const ins = db.prepare('INSERT OR IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)');
    subjectIds.map(Number).forEach((sid) => ins.run(sid, target.id));
  }
  recordLog(req.user, 'UPDATE', 'sys_user', target.id, { role: target.role }, { role, subjectIds });
  ok(res, { ok: true, role, subjectIds: role === 'REP' ? (subjectIds || []) : [] });
});

module.exports = router;
