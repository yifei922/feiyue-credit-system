const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail, fmtDate } = require('../util');
const { getManagedSubjectIds, requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 积分流水
router.get('/', async (req, res) => {
  const params = [];
  let sql = `SELECT f.*, s.name AS userName, t.title AS taskTitle, t.subject_id AS subjectId
             FROM credit_flow f
             LEFT JOIN student s ON f.student_id=s.id
             LEFT JOIN task t ON f.task_id=t.id WHERE 1=1`;
  if (req.user.role === 'STUDENT') {
    sql += ' AND f.student_id=?';
    params.push(req.user.studentId);
  } else if (req.user.role === 'REP') {
    const ids = await getManagedSubjectIds(req.user);
    if (ids.length === 0) return ok(res, []);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (req.query.userId) { sql += ' AND f.student_id=?'; params.push(Number(req.query.userId)); }
  if (req.query.flowType) { sql += ' AND f.flow_type=?'; params.push(req.query.flowType); }
  sql += ' ORDER BY f.id DESC';
  const rows = await db.prepare(sql).all(...params);
  ok(res, await Promise.all(rows.map(async r => ({
    id: r.id,
    userId: r.student_id,
    userName: r.userName || '未知',
    taskId: r.task_id,
    taskTitle: r.taskTitle,
    creditChange: r.change_amount,
    flowType: r.flow_type,
    createTime: fmtDate(r.create_time)
  }))));
});

// 手动增减积分（管理员/主理人/小组长）
// body: { studentId, amount(可正可负), reason }
router.post('/adjust', requireRole('ADMIN', 'TEACHER', 'REP'), async (req, res) => {
  const studentId = Number(req.body?.studentId);
  const amount = Number(req.body?.amount);
  const reason = String(req.body?.reason || '').trim() || '手动调整';
  if (!studentId) return fail(res, 400, '请指定成员');
  if (!Number.isFinite(amount) || amount === 0) return fail(res, 400, '调整分值必须为非 0 数字');

  const student = await db.prepare('SELECT * FROM student WHERE id=?').get(studentId);
  if (!student) return fail(res, 404, '成员不存在');

  await db.prepare('INSERT INTO credit_flow(student_id, task_id, change_amount, flow_type, reason) VALUES(?,?,?,?,?)')
    .run(studentId, null, amount, 'MANUAL', reason);
  // 增量回写（原子单条 SQL + amount），不再依赖全量 SUM 重算，避免并发覆盖
  await db.prepare('UPDATE student SET total_credits = total_credits + ? WHERE id=?')
    .run(amount, studentId);
  const total = await (await db.prepare('SELECT total_credits AS t FROM student WHERE id=?').get(studentId)).t;

  recordLog(req.user, 'UPDATE', 'credit_flow', studentId, null, { amount, reason, total });
  ok(res, { ok: true, studentId, amount, total });
});

module.exports = router;
