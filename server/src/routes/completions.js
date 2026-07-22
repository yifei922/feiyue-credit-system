const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');
const { requireRole, canManageSubject, getManagedSubjectIds } = require('../middleware/rbac');
const { calcCredit } = require('../services/credit');
const { recordLog } = require('../services/log');

// 写入单条完成记录 + 流水 + 重算总学分（被 /register 与 /import 复用，保证幂等）
function registerCompletion(task, sid, status, operator) {
  const { credit, flowType } = calcCredit(task.credit_value, task.type, status);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const isDone = status === 'DONE_ONTIME' || status === 'DONE_OVERDUE';
  db.prepare('DELETE FROM completion_record WHERE task_id=? AND student_id=?').run(task.id, sid);
  db.prepare('DELETE FROM credit_flow WHERE task_id=? AND student_id=?').run(task.id, sid);
  const info = db.prepare('INSERT INTO completion_record(task_id, student_id, status, completion_time, credit_earned, operator_id) VALUES(?,?,?,?,?,?)')
    .run(task.id, sid, status, isDone ? now : null, credit, operator.id);
  const recId = info.lastInsertRowid;
  if (credit > 0) {
    db.prepare('INSERT INTO credit_flow(student_id, task_id, change_amount, flow_type, reason) VALUES(?,?,?,?,?)')
      .run(sid, task.id, credit, flowType, task.title);
  }
  db.prepare('UPDATE student SET total_credits = (SELECT COALESCE(SUM(change_amount),0) FROM credit_flow WHERE student_id=?) WHERE id=?')
    .run(sid, sid);
  return { credit, recId };
}

// 完成登记：计算学分、写入完成记录 + 流水、更新总学分
router.post('/register', requireRole('ADMIN', 'TEACHER', 'REP', 'STUDENT'), (req, res) => {
  const { taskId, studentIds, status } = req.body || {};
  if (!taskId || !status) return fail(res, 400, '缺少任务或状态');

  // 学生只能登记自己
  let sids = [];
  if (req.user.role === 'STUDENT') {
    sids = [req.user.studentId];
  } else {
    sids = Array.isArray(studentIds) ? studentIds.map(Number) : (studentIds ? [Number(studentIds)] : []);
  }
  if (sids.length === 0) return fail(res, 400, '请选择学生');

  const task = db.prepare('SELECT * FROM task WHERE id=?').get(taskId);
  if (!task) return fail(res, 404, '任务不存在');

  // 课代表只能登记自己负责的科目
  if (req.user.role === 'REP' && !canManageSubject(req.user, task.subject_id)) {
    return fail(res, 403, '你只能登记自己负责的科目');
  }

  let gained = 0;
  sids.forEach((sid) => { gained += registerCompletion(task, sid, status, req.user).credit; });

  recordLog(req.user, 'UPSERT', 'completion_record', taskId, null, { studentIds: sids, status, gained });
  ok(res, { affected: sids.length, gained });
});

// 成绩导入（管理员/老师/课代表）：CSV 或 JSON 数组
// CSV 表头支持：student_no / student_name / task_id / task_title / status（也可无表头，按列序 学号,任务ID,状态）
router.post('/import', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const body = req.body || {};
  let rows = [];
  if (body.csv) {
    const lines = String(body.csv).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return fail(res, 400, 'CSV 为空');
    const header = lines[0].toLowerCase();
    const hasHeader = /student_no|student_name|task_id|task_title|status/.test(header);
    const cols = hasHeader ? header.split(/[,\t]/).map(x => x.trim()) : ['student_no', 'task_id', 'status'];
    const idx = (names) => { for (const n of names) { const i = cols.indexOf(n); if (i >= 0) return i; } return -1; };
    const iNo = idx(['student_no']);
    const iName = idx(['student_name', 'name']);
    const iTaskId = idx(['task_id']);
    const iTaskTitle = idx(['task_title', 'title']);
    const iStatus = idx(['status', 'state']);
    rows = lines.slice(hasHeader ? 1 : 0).map(line => {
      const p = line.split(/[,\t]/).map(x => x.trim());
      return {
        studentNo: iNo >= 0 ? p[iNo] : '',
        studentName: iName >= 0 ? p[iName] : '',
        taskId: iTaskId >= 0 ? p[iTaskId] : '',
        taskTitle: iTaskTitle >= 0 ? p[iTaskTitle] : '',
        status: iStatus >= 0 ? p[iStatus] : ''
      };
    });
  } else if (Array.isArray(body.records)) {
    rows = body.records.map(r => ({
      studentNo: r.studentNo || r.student_no || '',
      studentName: r.studentName || r.student_name || r.name || '',
      taskId: r.taskId ?? r.task_id ?? '',
      taskTitle: r.taskTitle || r.task_title || r.title || '',
      status: r.status || ''
    }));
  }
  rows = rows.filter(r => (r.studentNo || r.studentName) && (r.taskId || r.taskTitle) && r.status);
  if (rows.length === 0) return fail(res, 400, '没有可导入的成绩记录（请检查数据格式）');

  const validStatus = ['DONE_ONTIME', 'DONE_OVERDUE', 'UNFINISHED', 'FAILED'];
  let imported = 0, skipped = 0;
  const errors = [];
  for (const r of rows) {
    // 解析学生
    let student = null;
    if (r.studentNo) student = db.prepare('SELECT * FROM student WHERE student_no=?').get(r.studentNo);
    if (!student && r.studentName) student = db.prepare('SELECT * FROM student WHERE name=?').get(r.studentName);
    if (!student) { skipped++; errors.push(`学生未找到: ${r.studentNo || r.studentName}`); continue; }
    // 解析任务
    let task = null;
    if (r.taskId && /^\d+$/.test(String(r.taskId))) task = db.prepare('SELECT * FROM task WHERE id=?').get(Number(r.taskId));
    if (!task && r.taskTitle) task = db.prepare('SELECT * FROM task WHERE title LIKE ?').get('%' + r.taskTitle + '%');
    if (!task) { skipped++; errors.push(`任务未找到: ${r.taskId || r.taskTitle}`); continue; }
    // 状态校验
    const status = String(r.status).toUpperCase();
    if (!validStatus.includes(status)) { skipped++; errors.push(`状态非法: ${r.status}`); continue; }
    // 课代表科目隔离
    if (req.user.role === 'REP' && !canManageSubject(req.user, task.subject_id)) {
      skipped++; errors.push(`无权限科目: ${task.title}`); continue;
    }
    registerCompletion(task, student.id, status, req.user);
    imported++;
  }
  recordLog(req.user, 'IMPORT', 'completion_record', null, null, { imported, skipped, sample: rows.slice(0, 5) });
  ok(res, { imported, skipped, errors: errors.slice(0, 20), total: rows.length });
});

// 成绩明细导出（角色隔离：学生仅本人，课代表仅负责科目）
router.get('/export', (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const params = [];
  let sql = `SELECT cr.student_id AS studentId, s.student_no AS studentNo, s.name AS studentName,
                    t.title AS taskTitle, sub.name AS subject, cr.status, cr.credit_earned AS creditEarned,
                    cr.completion_time AS completionTime
             FROM completion_record cr
             LEFT JOIN student s ON cr.student_id=s.id
             LEFT JOIN task t ON cr.task_id=t.id
             LEFT JOIN subject sub ON t.subject_id=sub.id WHERE 1=1`;
  if (req.user.role === 'STUDENT') {
    sql += ' AND cr.student_id=?'; params.push(req.user.studentId);
  } else if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    if (ids.length === 0) return ok(res, []);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  // 教师/课代表可按学生导出某位同学的成绩单；学生角色已在上面强制为本人，忽略此参数
  if (req.user.role !== 'STUDENT' && req.query.studentId) {
    sql += ' AND cr.student_id=?'; params.push(Number(req.query.studentId));
  }
  if (req.query.taskId) { sql += ' AND cr.task_id=?'; params.push(Number(req.query.taskId)); }
  sql += ' ORDER BY cr.id DESC';
  const rows = db.prepare(sql).all(...params);

  if (format === 'json') return ok(res, rows);

  const header = 'student_no,student_name,task_title,subject,status,credit_earned,completion_time';
  const lines = [
    header,
    ...rows.map(r => `${r.studentNo || ''},${r.studentName || ''},${r.taskTitle || ''},${r.subject || ''},${r.status || ''},${r.creditEarned || 0},${r.completionTime || ''}`)
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="completions.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

// 完成记录列表
router.get('/', (req, res) => {
  const params = [];
  let sql = `SELECT cr.*, s.name AS studentName, t.title AS taskTitle, t.subject_id AS subjectId
             FROM completion_record cr
             LEFT JOIN student s ON cr.student_id=s.id
             LEFT JOIN task t ON cr.task_id=t.id WHERE 1=1`;
  if (req.user.role === 'STUDENT') {
    sql += ' AND cr.student_id=?';
    params.push(req.user.studentId);
  } else if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    if (ids.length === 0) return ok(res, []);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (req.query.taskId) { sql += ' AND cr.task_id=?'; params.push(Number(req.query.taskId)); }
  if (req.query.studentId) { sql += ' AND cr.student_id=?'; params.push(Number(req.query.studentId)); }
  sql += ' ORDER BY cr.id DESC';
  const rows = db.prepare(sql).all(...params);
  const attStmt = db.prepare('SELECT id, original_name AS originalName, stored_name AS storedName, mime, size_original AS sizeOriginal, size_compressed AS sizeCompressed, width, height FROM attachment WHERE task_id=? AND student_id=?');
  ok(res, rows.map(r => ({
    id: r.id, taskId: r.task_id, studentId: r.student_id, studentName: r.studentName,
    taskTitle: r.taskTitle, status: r.status, completionTime: r.completion_time, creditEarned: r.credit_earned,
    attachments: attStmt.all(r.task_id, r.student_id).map(a => ({ ...a, url: `/api/uploads/${a.storedName}` }))
  })));
});

module.exports = router;
