const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail, fmtDate } = require('../util');
const { requireRole, getManagedSubjectIds, ROLE_LABEL } = require('../middleware/rbac');
const { ALERT_TYPE_LABEL } = require('../services/credit');
const { recordLog } = require('../services/log');

// 列表
router.get('/', (req, res) => {
  let rows;
  if (req.user.role === 'STUDENT') {
    rows = db.prepare(`SELECT a.*, s.name AS studentName, c.name AS className
                       FROM alert a LEFT JOIN student s ON a.student_id=s.id LEFT JOIN clazz c ON s.class_id=c.id
                       WHERE a.student_id=? ORDER BY a.id DESC`).all(req.user.studentId);
  } else {
    rows = db.prepare(`SELECT a.*, s.name AS studentName, c.name AS className
                       FROM alert a LEFT JOIN student s ON a.student_id=s.id LEFT JOIN clazz c ON s.class_id=c.id
                       ORDER BY a.id DESC`).all();
  }
  ok(res, rows.map(r => ({
    id: r.id, studentId: r.student_id, studentName: r.studentName, classId: r.class_id,
    className: r.className, type: r.type, reason: r.message, status: r.status,
    createTime: fmtDate(r.create_time), typeText: ALERT_TYPE_LABEL[r.type] || r.type
  })));
});

// 手动扫描生成预警
router.post('/scan', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const managed = req.user.role === 'REP' ? getManagedSubjectIds(req.user) : null;
  let count = 0;

  const existsPending = (studentId, type) =>
    db.prepare("SELECT id FROM alert WHERE student_id=? AND type=? AND status='PENDING'").get(studentId, type);

  // 1) 临近截止未完成
  const tasks = db.prepare("SELECT * FROM task WHERE status='OPEN'").all();
  tasks.forEach(t => {
    if (managed && !managed.includes(t.subject_id)) return;
    if (!t.deadline) return;
    const due = new Date(String(t.deadline).replace(/-/g, '/')).getTime();
    const soon = Date.now() + 3 * 24 * 3600 * 1000;
    if (due > soon || isNaN(due)) return;
    const recs = db.prepare("SELECT * FROM completion_record WHERE task_id=? AND status='UNFINISHED'").all(t.id);
    recs.forEach(r => {
      if (existsPending(r.student_id, 'OVERDUE_SOON')) return;
      db.prepare('INSERT INTO alert(student_id,type,level,message) VALUES(?,?,?,?)')
        .run(r.student_id, 'OVERDUE_SOON', 'WARN', `《${t.title}》将于 ${t.deadline} 截止且尚未完成`);
      count++;
    });
  });

  // 2) 学分偏低
  const lowThresh = 5;
  let scope = db.prepare('SELECT * FROM student').all();
  if (managed) {
    const ids = db.prepare(`SELECT DISTINCT student_id FROM completion_record cr JOIN task t ON cr.task_id=t.id WHERE t.subject_id IN (${managed.map(() => '?').join(',')})`).all(...managed).map(x => x.student_id);
    scope = scope.filter(s => ids.includes(s.id));
  }
  scope.forEach(s => {
    if ((s.total_credits || 0) < lowThresh && !existsPending(s.id, 'LOW_CREDIT')) {
      db.prepare('INSERT INTO alert(student_id,type,level,message) VALUES(?,?,?,?)')
        .run(s.id, 'LOW_CREDIT', 'WARN', `当前学分 ${s.total_credits}，低于预警线 ${lowThresh}`);
      count++;
    }
  });

  recordLog(req.user, 'SCAN', 'alert', null, null, { count });
  ok(res, { ok: true, count });
});

// 一键提醒所有「未完成」学生（管理员/老师/课代表，REP 限本科目范围）
// 为每位有未完成任务的学生生成一条 REMIND 提醒，学生端可在「我的提醒」看到
router.post('/remind-unfinished', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const managed = req.user.role === 'REP' ? getManagedSubjectIds(req.user) : null;
  if (managed && managed.length === 0) return ok(res, { ok: true, count: 0 });

  // 查未完成记录（带任务标题、科目），按学生聚合
  let sql = `SELECT cr.student_id, t.title, t.subject_id
             FROM completion_record cr JOIN task t ON cr.task_id=t.id
             WHERE cr.status='UNFINISHED'`;
  const params = [];
  if (managed) {
    sql += ` AND t.subject_id IN (${managed.map(() => '?').join(',')})`;
    params.push(...managed);
  }
  const rows = db.prepare(sql).all(...params);

  const byStudent = new Map();
  rows.forEach((r) => {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
    byStudent.get(r.student_id).push(r.title);
  });

  let count = 0;
  const insAlert = db.prepare('INSERT INTO alert(student_id,type,level,message) VALUES(?,?,?,?)');
  for (const [studentId, titles] of byStudent.entries()) {
    // 先清掉该生旧的待处理提醒，避免堆积重复
    db.prepare("UPDATE alert SET status='RESOLVED' WHERE student_id=? AND type='REMIND' AND status='PENDING'").run(studentId);
    const list = titles.slice(0, 5).join('、') + (titles.length > 5 ? ` 等${titles.length}项` : '');
    insAlert.run(studentId, 'REMIND', 'WARN', `你还有 ${titles.length} 项任务未完成：${list}，请尽快完成！`);
    count++;
  }
  recordLog(req.user, 'REMIND', 'alert', null, null, { count });
  ok(res, { ok: true, count });
});

// 给单个学生发送自定义提醒（管理员/老师/课代表）
router.post('/notify', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const studentId = Number(req.body?.studentId);
  const message = String(req.body?.message || '').trim();
  if (!studentId || !message) return fail(res, 400, '请指定学生和提醒内容');
  const stu = db.prepare('SELECT id FROM student WHERE id=?').get(studentId);
  if (!stu) return fail(res, 404, '学生不存在');
  db.prepare('INSERT INTO alert(student_id,type,level,message) VALUES(?,?,?,?)')
    .run(studentId, 'REMIND', 'INFO', message);
  recordLog(req.user, 'REMIND', 'alert', studentId, null, { message });
  ok(res, { ok: true });
});

// 解决
router.put('/:id/resolve', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const before = db.prepare('SELECT * FROM alert WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '预警不存在');
  db.prepare("UPDATE alert SET status='RESOLVED' WHERE id=?").run(req.params.id);
  recordLog(req.user, 'UPDATE', 'alert', req.params.id, before, { status: 'RESOLVED' });
  ok(res, { ok: true });
});

module.exports = router;
