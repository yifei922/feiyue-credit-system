const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { verifyPassword, signToken } = require('../auth');
const { ok, fail } = require('../util');
const authMiddleware = require('../middleware/auth');
const { getManagedSubjectIds } = require('../middleware/rbac');

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, '请输入账号和密码');
  const user = db.prepare('SELECT * FROM sys_user WHERE username=?').get(username);
  if (!user || !verifyPassword(password, user.password)) return fail(res, 401, '用户名或密码错误');
  const managedSubjects = getManagedSubjectIds({ id: user.id, role: user.role });
  const token = signToken({
    id: user.id, username: user.username, role: user.role, name: user.name, studentId: user.student_id
  });
  ok(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.name,
      role: user.role,
      classId: user.class_id,
      studentId: user.student_id,
      managedSubjects
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id,username,name,role,class_id,student_id FROM sys_user WHERE id=?').get(req.user.id);
  if (!user) return fail(res, 404, '用户不存在');
  const managedSubjects = getManagedSubjectIds({ id: user.id, role: user.role });
  ok(res, {
    id: user.id,
    username: user.username,
    realName: user.name,
    role: user.role,
    classId: user.class_id,
    studentId: user.student_id,
    managedSubjects
  });
});

module.exports = router;
