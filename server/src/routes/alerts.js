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

// 解决
router.put('/:id/resolve', requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const before = db.prepare('SELECT * FROM alert WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '预警不存在');
  db.prepare("UPDATE alert SET status='RESOLVED' WHERE id=?").run(req.params.id);
  recordLog(req.user, 'UPDATE', 'alert', req.params.id, before, { status: 'RESOLVED' });
  ok(res, { ok: true });
});

module.exports = router;
