const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { verifyPassword, signToken, hashPassword } = require('../auth');
const { ok, fail } = require('../util');
const authMiddleware = require('../middleware/auth');
const { getManagedSubjectIds } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, '请输入账号和密码');
  const user = await db.prepare('SELECT * FROM sys_user WHERE username=?').get(username);
  if (!user || !verifyPassword(password, user.password)) return fail(res, 401, '用户名或密码错误');
  const managedSubjects = await getManagedSubjectIds({ id: user.id, role: user.role });
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
      managedSubjects,
      mustChangePwd: !!user.must_change_pwd
    }
  });
});

// 修改密码（需登录）。强制改密态(must_change_pwd=1)下可不校验旧密码；
// 已改密后的常规修改必须校验旧密码。成功后清除强制改密标记。
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) return fail(res, 400, '新密码至少 4 位');
  if (String(newPassword).length > 64) return fail(res, 400, '密码过长');
  const user = await db.prepare('SELECT * FROM sys_user WHERE id=?').get(req.user.id);
  if (!user) return fail(res, 404, '用户不存在');
  if (!user.must_change_pwd) {
    if (!oldPassword || !verifyPassword(oldPassword, user.password)) {
      return fail(res, 400, '原密码错误');
    }
  }
  if (oldPassword && verifyPassword(newPassword, user.password)) {
    return fail(res, 400, '新密码不能与原密码相同');
  }
  await db.prepare('UPDATE sys_user SET password=?, must_change_pwd=0 WHERE id=?')
    .run(hashPassword(newPassword), user.id);
  recordLog(req.user, 'UPDATE', 'sys_user', user.id, { username: user.username }, { action: 'change-password' });
  ok(res, { ok: true, mustChangePwd: false });
});

// 忘记密码（走微信身份校验）：仅在小程序微信登录体系下可用，由 mp_auth 复用此逻辑。
// 此处暴露为 Web 端占位，避免明文默认密码被滥用；具体微信校验见 mp_auth。
router.post('/forgot-password', async (req, res) => {
  // 真实实现需校验微信身份(openid)或短信验证码，这里仅返回引导，不落地改密
  return fail(res, 428, '请通过微信登录后在小程序内重置密码，或联系管理员重置');
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await db.prepare('SELECT id,username,name,role,class_id,student_id FROM sys_user WHERE id=?').get(req.user.id);
  if (!user) return fail(res, 404, '用户不存在');
  const managedSubjects = await getManagedSubjectIds({ id: user.id, role: user.role });
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
