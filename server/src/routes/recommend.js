const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok } = require('../util');
const { TYPE_LABEL } = require('../services/credit');

// 推荐：该生未完成 / 未通过的同班任务
router.get('/', (req, res) => {
  let studentId = Number(req.query.studentId);
  if (req.user.role === 'STUDENT') studentId = req.user.studentId;
  if (!studentId) return ok(res, []);

  const recs = [];
  const comps = db.prepare("SELECT * FROM completion_record WHERE student_id=? AND status IN ('UNFINISHED','FAILED')").all(studentId);
  comps.forEach(c => {
    const t = db.prepare('SELECT * FROM task WHERE id=?').get(c.task_id);
    if (!t) return;
    recs.push({
      taskId: t.id,
      title: t.title,
      subjectName: db.prepare('SELECT name FROM subject WHERE id=?').get(t.subject_id)?.name || '',
      type: t.type,
      typeText: TYPE_LABEL[t.type] || t.type,
      creditValue: t.credit_value,
      reason: c.status === 'FAILED' ? '上次未通过，建议补修' : '尚未完成，临近截止'
    });
  });
  ok(res, recs);
});

module.exports = router;
