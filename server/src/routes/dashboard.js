const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fmtDate } = require('../util');
const { getManagedSubjectIds } = require('../middleware/rbac');
const { STATUS_LABEL } = require('../services/credit');

function scopeTasks(user) {
  if (user.role === 'REP') {
    const ids = getManagedSubjectIds(user);
    if (ids.length === 0) return [];
    return db.prepare(`SELECT * FROM task WHERE subject_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  }
  return db.prepare('SELECT * FROM task').all();
}

// 看板总览
router.get('/overview', (req, res) => {
  const tasks = scopeTasks(req.user);
  const taskIds = tasks.map(t => t.id);

  // 各科目完成率
  let subjects;
  if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    subjects = ids.length ? db.prepare(`SELECT * FROM subject WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
  } else {
    subjects = db.prepare('SELECT * FROM subject').all();
  }
  const subjectCompletionRate = subjects.map(s => {
    const recs = db.prepare(`SELECT cr.* FROM completion_record cr JOIN task t ON cr.task_id=t.id WHERE t.subject_id=?`).all(s.id);
    const total = recs.length;
    const done = recs.filter(r => r.status === 'DONE_ONTIME' || r.status === 'DONE_OVERDUE').length;
    return { subjectName: s.name, total, done, completionRate: total ? Math.round((done / total) * 100) : 0 };
  });

  // 状态分布（范围内）
  let distSql = `SELECT cr.* FROM completion_record cr JOIN task t ON cr.task_id=t.id WHERE 1=1`;
  if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    distSql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
  }
  const allComp = req.user.role === 'REP'
    ? db.prepare(distSql).all(...getManagedSubjectIds(req.user))
    : db.prepare(distSql).all();
  const statusDistribution = {
    unfinished: allComp.filter(r => r.status === 'UNFINISHED').length,
    ontime: allComp.filter(r => r.status === 'DONE_ONTIME').length,
    overdue: allComp.filter(r => r.status === 'DONE_OVERDUE').length,
    failed: allComp.filter(r => r.status === 'FAILED').length
  };

  const studentCount = db.prepare('SELECT COUNT(*) AS c FROM student').get().c;
  const taskCount = tasks.length;
  const avgRow = db.prepare('SELECT COALESCE(AVG(total_credits),0) AS a FROM student').get();
  const summary = {
    studentCount,
    taskCount,
    avgCredits: Math.round(avgRow.a)
  };

  ok(res, { subjectCompletionRate, statusDistribution, summary });
});

// 完成情况小计总览：整体完成/未完成人数、各任务完成小计、未完成学生清单
// REP 仅统计自己负责的科目范围
router.get('/completion-summary', (req, res) => {
  const managed = req.user.role === 'REP' ? getManagedSubjectIds(req.user) : null;
  if (managed && managed.length === 0) {
    return ok(res, { totalStudents: 0, doneStudents: 0, unfinishedStudents: 0, byTask: [], unfinishedList: [] });
  }

  // 范围内的任务
  let taskSql = 'SELECT t.*, s.name AS subjectName FROM task t LEFT JOIN subject s ON t.subject_id=s.id WHERE 1=1';
  const tParams = [];
  if (managed) { taskSql += ` AND t.subject_id IN (${managed.map(() => '?').join(',')})`; tParams.push(...managed); }
  const tasks = db.prepare(taskSql).all(...tParams);

  // 各任务完成小计
  const byTask = tasks.map((t) => {
    const recs = db.prepare('SELECT status FROM completion_record WHERE task_id=?').all(t.id);
    const done = recs.filter((r) => r.status === 'DONE_ONTIME' || r.status === 'DONE_OVERDUE').length;
    const unfinished = recs.filter((r) => r.status === 'UNFINISHED').length;
    return { taskId: t.id, title: t.title, subjectName: t.subjectName, done, unfinished, total: recs.length };
  });

  // 未完成学生聚合（含待完成任务标题）
  let unfSql = `SELECT cr.student_id, s.name AS studentName, s.student_no AS studentNo, t.title
                FROM completion_record cr
                JOIN task t ON cr.task_id=t.id
                LEFT JOIN student s ON cr.student_id=s.id
                WHERE cr.status='UNFINISHED'`;
  const uParams = [];
  if (managed) { unfSql += ` AND t.subject_id IN (${managed.map(() => '?').join(',')})`; uParams.push(...managed); }
  const unfRows = db.prepare(unfSql).all(...uParams);
  const map = new Map();
  unfRows.forEach((r) => {
    if (!map.has(r.student_id)) map.set(r.student_id, { studentId: r.student_id, studentName: r.studentName, studentNo: r.studentNo, tasks: [] });
    map.get(r.student_id).tasks.push(r.title);
  });
  const unfinishedList = [...map.values()].map((u) => ({ ...u, pendingCount: u.tasks.length }));

  const totalStudents = db.prepare('SELECT COUNT(*) AS c FROM student').get().c;
  const unfinishedStudents = unfinishedList.length;
  const doneStudents = Math.max(totalStudents - unfinishedStudents, 0);

  ok(res, { totalStudents, doneStudents, unfinishedStudents, byTask, unfinishedList });
});

// 学分趋势（按流水累计）
router.get('/credit-trend', (req, res) => {
  let studentId = Number(req.query.studentId);
  if (req.user.role === 'STUDENT') studentId = req.user.studentId;
  if (!studentId) return ok(res, []);
  const list = db.prepare('SELECT * FROM credit_flow WHERE student_id=? ORDER BY create_time').all(studentId);
  const base = db.prepare('SELECT total_credits FROM student WHERE id=?').get(studentId);
  let running = (base?.total_credits || 0) - list.reduce((s, f) => s + f.change_amount, 0);
  const series = list.map(f => {
    running += f.change_amount;
    return { date: fmtDate(f.create_time) || '—', credits: running };
  });
  if (series.length === 0) series.push({ date: '—', credits: base?.total_credits || 0 });
  ok(res, series);
});

// 下钻：某科目各任务完成情况
router.get('/drill/subject', (req, res) => {
  const subjectId = Number(req.query.subjectId);
  if (!subjectId) return ok(res, []);
  const tasks = db.prepare('SELECT * FROM task WHERE subject_id=?').all(subjectId);
  const rows = tasks.map(t => {
    let recs = db.prepare('SELECT cr.*, s.name AS studentName FROM completion_record cr LEFT JOIN student s ON cr.student_id=s.id WHERE cr.task_id=?').all(t.id);
    if (req.user.role === 'STUDENT') recs = recs.filter(r => r.student_id === req.user.studentId);
    return {
      taskId: t.id, title: t.title,
      records: recs.map(r => ({ studentName: r.studentName, status: STATUS_LABEL[r.status] || r.status }))
    };
  });
  ok(res, rows);
});

// 下钻：某状态涉及的任务/学生
router.get('/drill/status', (req, res) => {
  const status = req.query.status;
  if (!status) return ok(res, []);
  const params = [status];
  let sql = `SELECT cr.*, s.name AS studentName, t.title AS taskTitle FROM completion_record cr
             LEFT JOIN student s ON cr.student_id=s.id LEFT JOIN task t ON cr.task_id=t.id WHERE cr.status=?`;
  if (req.user.role === 'REP') {
    const ids = getManagedSubjectIds(req.user);
    sql += ` AND t.subject_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (req.user.role === 'STUDENT') { sql += ' AND cr.student_id=?'; params.push(req.user.studentId); }
  const rows = db.prepare(sql).all(...params).map(r => ({ taskTitle: r.taskTitle, studentName: r.studentName, status: STATUS_LABEL[r.status] || r.status }));
  ok(res, rows);
});

module.exports = router;
