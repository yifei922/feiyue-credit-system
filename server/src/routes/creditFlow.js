const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fmtDate } = require('../util');
const { getManagedSubjectIds } = require('../middleware/rbac');

// 积分流水
router.get('/', (req, res) => {
  const params = [];
  let sql = `SELECT f.*, s.name AS userName, t.title AS taskTitle, t.subject_id AS subjectId
             FROM credit_flow f
             LEFT JOIN student s ON f.student_id=s.id
             LEFT JOIN task t ON f.task_id=t.id WHERE 1=1`;
  if (req.user.role === 'STUDENT') {
    sql += ' AND f.student_id=?';
    params.push(req.user.studentId);
  } else if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    if (ids.length === 0) return ok(res, []);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (req.query.userId) { sql += ' AND f.student_id=?'; params.push(Number(req.query.userId)); }
  if (req.query.flowType) { sql += ' AND f.flow_type=?'; params.push(req.query.flowType); }
  sql += ' ORDER BY f.id DESC';
  const rows = db.prepare(sql).all(...params);
  ok(res, rows.map(r => ({
    id: r.id,
    userId: r.student_id,
    userName: r.userName || '未知',
    taskId: r.task_id,
    taskTitle: r.taskTitle,
    creditChange: r.change_amount,
    flowType: r.flow_type,
    createTime: fmtDate(r.create_time)
  })));
});

module.exports = router;
