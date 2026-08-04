const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');
const authMiddleware = require('../middleware/auth');
const { requireRole, getManagedSubjectIds } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 列表
router.get('/', authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    if (ids.length === 0) rows = [];
    else rows = db.prepare(`SELECT * FROM subject WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  } else {
    rows = db.prepare('SELECT * FROM subject ORDER BY id').all();
  }
  const result = rows.map(s => {
    const reps = db.prepare(`SELECT u.id, u.name FROM subject_rep sr JOIN sys_user u ON sr.user_id=u.id WHERE sr.subject_id=?`).all(s.id);
    return { id: s.id, name: s.name, classId: s.class_id, teacherId: s.teacher_id, repUserIds: reps.map(r => r.id), repNames: reps.map(r => r.name) };
  });
  ok(res, result);
});

// 新增（管理员/老师）
router.post('/', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const { name, classId, teacherId } = req.body || {};
  if (!name) return fail(res, 400, '请填写科目名称');
  const r = db.prepare('INSERT INTO subject(name, class_id, teacher_id) VALUES(?,?,?)').run(name, classId || req.user.class_id || 1, teacherId || null);
  recordLog(req.user, 'INSERT', 'subject', r.lastInsertRowid, null, { name });
  ok(res, { id: r.lastInsertRowid, name });
});

// 设置课代表（管理员/老师）
router.post('/:id/reps', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const subjectId = req.params.id;
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number) : [];
  db.prepare('DELETE FROM subject_rep WHERE subject_id=?').run(subjectId);
  const ins = db.prepare('INSERT OR IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)');
  userIds.forEach(uid => ins.run(subjectId, uid));
  recordLog(req.user, 'UPDATE', 'subject_rep', subjectId, null, { userIds });
  ok(res, { ok: true, repCount: userIds.length });
});

// 更新
router.put('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const { name, teacherId } = req.body || {};
  const before = db.prepare('SELECT * FROM subject WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '科目不存在');
  db.prepare('UPDATE subject SET name=?, teacher_id=? WHERE id=?').run(name ?? before.name, teacherId ?? before.teacher_id, req.params.id);
  recordLog(req.user, 'UPDATE', 'subject', req.params.id, before, { name, teacherId });
  ok(res, { ok: true });
});

// 删除
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const before = db.prepare('SELECT * FROM subject WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '科目不存在');
  db.prepare('DELETE FROM subject_rep WHERE subject_id=?').run(req.params.id);
  db.prepare('DELETE FROM subject WHERE id=?').run(req.params.id);
  recordLog(req.user, 'DELETE', 'subject', req.params.id, before, null);
  ok(res, { ok: true });
});

module.exports = router;
