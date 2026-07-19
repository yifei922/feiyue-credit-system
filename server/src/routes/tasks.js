const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');
const { requireRole, canManageSubject, getManagedSubjectIds } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

function shape(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    classId: row.class_id,
    title: row.title,
    type: row.type,
    creditValue: row.credit_value,
    deadline: row.deadline,
    status: row.status,
    subjectName: row.subjectName,
    creatorId: row.creator_id
  };
}

// 列表
router.get('/', (req, res) => {
  const params = [];
  let sql = `SELECT t.*, s.name AS subjectName FROM task t LEFT JOIN subject s ON t.subject_id=s.id WHERE 1=1`;
  if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    if (ids.length === 0) return ok(res, []);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (req.query.subjectId) {
    sql += ' AND t.subject_id=?';
    params.push(Number(req.query.subjectId));
  }
  sql += ' ORDER BY t.id';
  const rows = db.prepare(sql).all(...params);
  ok(res, rows.map(shape));
});

// 新增
router.post('/', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const { title, subjectId, creditValue, type, deadline, description } = req.body || {};
  if (!title || !subjectId) return fail(res, 400, '请填写任务标题与科目');
  if (req.user.role === 'REP' && !canManageSubject(req.user, subjectId)) {
    return fail(res, 403, '你只能安排自己负责的科目');
  }
  const r = db.prepare('INSERT INTO task(title, subject_id, class_id, credit_value, type, status, deadline, description, creator_id) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(title, subjectId, req.user.class_id || 1, creditValue || 0, type || 'HOMEWORK', 'OPEN', deadline || null, description || '', req.user.id);
  const row = db.prepare(`SELECT t.*, s.name AS subjectName FROM task t LEFT JOIN subject s ON t.subject_id=s.id WHERE t.id=?`).get(r.lastInsertRowid);
  recordLog(req.user, 'INSERT', 'task', r.lastInsertRowid, null, shape(row));
  ok(res, shape(row));
});

// 存为模板
router.post('/template', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const { title, subjectId, type, creditValue, description } = req.body || {};
  if (!title || !subjectId) return fail(res, 400, '请填写模板标题与科目');
  if (req.user.role === 'REP' && !canManageSubject(req.user, subjectId)) {
    return fail(res, 403, '你只能为负责的科目建模板');
  }
  const r = db.prepare('INSERT INTO task_template(name, subject_id, type, credit_value, description) VALUES(?,?,?,?,?)')
    .run(title + '·模板', subjectId, type || 'HOMEWORK', creditValue || 0, description || '');
  ok(res, { id: r.lastInsertRowid });
});

// 模板列表
router.get('/templates', (req, res) => {
  const rows = db.prepare('SELECT id, name, subject_id AS subjectId, type, credit_value AS creditValue, description, creator_id AS creatorId FROM task_template ORDER BY id').all();
  ok(res, rows);
});

// 从模板创建任务
router.post('/from-template/:id', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const tpl = db.prepare('SELECT * FROM task_template WHERE id=?').get(req.params.id);
  if (!tpl) return fail(res, 404, '模板不存在');
  if (req.user.role === 'REP' && !canManageSubject(req.user, tpl.subject_id)) {
    return fail(res, 403, '你只能安排自己负责的科目');
  }
  const r = db.prepare('INSERT INTO task(title, subject_id, class_id, credit_value, type, status, deadline, description, creator_id) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(tpl.name, tpl.subject_id, req.user.class_id || 1, tpl.credit_value, tpl.type, 'OPEN', null, tpl.description, req.user.id);
  const row = db.prepare(`SELECT t.*, s.name AS subjectName FROM task t LEFT JOIN subject s ON t.subject_id=s.id WHERE t.id=?`).get(r.lastInsertRowid);
  recordLog(req.user, 'INSERT', 'task', r.lastInsertRowid, null, shape(row));
  ok(res, shape(row));
});

// 更新
router.put('/:id', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const before = db.prepare('SELECT * FROM task WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '任务不存在');
  if (req.user.role === 'REP' && !canManageSubject(req.user, before.subject_id)) {
    return fail(res, 403, '你只能修改自己负责的科目任务');
  }
  const { title, subjectId, creditValue, type, deadline, description, status } = req.body || {};
  db.prepare('UPDATE task SET title=?, subject_id=?, credit_value=?, type=?, deadline=?, description=?, status=? WHERE id=?')
    .run(
      title ?? before.title, subjectId ?? before.subject_id, creditValue ?? before.credit_value,
      type ?? before.type, deadline ?? before.deadline, description ?? before.description, status ?? before.status, req.params.id
    );
  const row = db.prepare(`SELECT t.*, s.name AS subjectName FROM task t LEFT JOIN subject s ON t.subject_id=s.id WHERE t.id=?`).get(req.params.id);
  recordLog(req.user, 'UPDATE', 'task', req.params.id, before, shape(row));
  ok(res, shape(row));
});

// 删除（级联清理完成记录与流水）
router.delete('/:id', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const before = db.prepare('SELECT * FROM task WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '任务不存在');
  if (req.user.role === 'REP' && !canManageSubject(req.user, before.subject_id)) {
    return fail(res, 403, '你只能删除自己负责的科目任务');
  }
  db.prepare('DELETE FROM credit_flow WHERE task_id=?').run(req.params.id);
  db.prepare('DELETE FROM completion_record WHERE task_id=?').run(req.params.id);
  db.prepare('DELETE FROM task WHERE id=?').run(req.params.id);
  recordLog(req.user, 'DELETE', 'task', req.params.id, before, null);
  ok(res, { ok: true });
});

module.exports = router;
