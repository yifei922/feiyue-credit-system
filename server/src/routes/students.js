const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { hashPassword } = require('../auth');
const { ok, fail, fmtDate } = require('../util');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 列表：管理员/老师/课代表看全班；学生仅看自己
router.get('/', authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === 'STUDENT') {
    rows = db.prepare(`SELECT s.*, c.name AS className FROM student s LEFT JOIN clazz c ON s.class_id=c.id WHERE s.id=?`)
      .all(req.user.studentId);
  } else {
    rows = db.prepare(`SELECT s.*, c.name AS className FROM student s LEFT JOIN clazz c ON s.class_id=c.id ORDER BY s.id`).all();
  }
  ok(res, rows.map(r => ({
    id: r.id, studentNo: r.student_no, name: r.name, classId: r.class_id,
    totalCredits: r.total_credits, className: r.className
  })));
});

// 名单导出（管理员/老师/课代表）：CSV（带 BOM 兼容 Excel）或 JSON，含总学分
router.get('/export', authMiddleware, requireRole('ADMIN', 'TEACHER', 'REP'), (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const rows = db.prepare(
    `SELECT s.student_no AS studentNo, s.name, c.name AS className, s.total_credits AS totalCredits
     FROM student s LEFT JOIN clazz c ON s.class_id=c.id ORDER BY s.id`
  ).all();

  if (format === 'json') return ok(res, rows);

  const header = 'student_no,name,class_name,total_credits';
  const lines = [
    header,
    ...rows.map(r => `${r.studentNo || ''},${r.name},${r.className || ''},${r.totalCredits || 0}`)
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

// 名单导入（管理员/老师）：支持 JSON 数组或 CSV 文本
router.post('/import', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const body = req.body || {};
  let list = [];
  if (body.csv) {
    const lines = String(body.csv).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const start = /^(name|姓名|学生|学号|studentno|student_no)/i.test(lines[0] || '') ? 1 : 0;
    list = lines.slice(start).map(line => {
      const [name, studentNo] = line.split(/[,\t]/).map(x => x.trim());
      return { name, studentNo };
    });
  } else if (Array.isArray(body.students)) {
    list = body.students.map(s => ({ name: String(s.name || '').trim(), studentNo: String(s.studentNo || s.studentNo || '') }));
  }
  list = list.filter(s => s.name);

  if (list.length === 0) return fail(res, 400, '没有可导入的学生（请检查数据格式）');

  const classId = req.user.class_id || 1;
  const insStu = db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)');
  const insUser = db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)');
  let imported = 0;
  const importedRows = [];
  for (const s of list) {
    // 按学号去重
    const exist = db.prepare('SELECT id FROM student WHERE student_no=?').get(s.studentNo);
    let studentId, isNew = false;
    if (exist) {
      studentId = exist.id;
    } else {
      const r = insStu.run(s.name, s.studentNo, classId);
      studentId = r.lastInsertRowid;
      isNew = true;
    }
    // 关联账号（若尚无对应 STUDENT 账号）
    const hasUser = db.prepare("SELECT id FROM sys_user WHERE role='STUDENT' AND student_id=?").get(studentId);
    if (!hasUser) {
      const username = 'stu' + String(studentId).padStart(2, '0');
      insUser.run(username, hashPassword('123456'), s.name, 'STUDENT', classId, studentId);
    }
    if (isNew) imported++;
    importedRows.push({ id: studentId, name: s.name, studentNo: s.studentNo });
  }

  recordLog(req.user, 'IMPORT', 'student', null, null, { count: imported, sample: importedRows.slice(0, 5) });
  ok(res, { imported, total: list.length, rows: importedRows });
});

// 新增单个学生（管理员/老师）
router.post('/', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const { name, studentNo } = req.body || {};
  if (!name) return fail(res, 400, '请填写学生姓名');
  const r = db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)').run(name, studentNo || '', req.user.class_id || 1);
  const studentId = r.lastInsertRowid;
  const username = 'stu' + String(studentId).padStart(2, '0');
  db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id) VALUES(?,?,?,?,?,?)')
    .run(username, hashPassword('123456'), name, 'STUDENT', req.user.class_id || 1, studentId);
  recordLog(req.user, 'INSERT', 'student', studentId, null, { name, studentNo });
  ok(res, { id: studentId, name, studentNo, username });
});

// 更新
router.put('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const { name, studentNo } = req.body || {};
  const before = db.prepare('SELECT * FROM student WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '学生不存在');
  db.prepare('UPDATE student SET name=?, student_no=? WHERE id=?').run(name ?? before.name, studentNo ?? before.student_no, req.params.id);
  db.prepare('UPDATE sys_user SET name=? WHERE role=? AND student_id=?').run(name ?? before.name, 'STUDENT', req.params.id);
  recordLog(req.user, 'UPDATE', 'student', req.params.id, before, { name, studentNo });
  ok(res, { ok: true });
});

// 删除
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), (req, res) => {
  const before = db.prepare('SELECT * FROM student WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '学生不存在');
  db.prepare('DELETE FROM sys_user WHERE role=? AND student_id=?').run('STUDENT', req.params.id);
  db.prepare('DELETE FROM student WHERE id=?').run(req.params.id);
  recordLog(req.user, 'DELETE', 'student', req.params.id, before, null);
  ok(res, { ok: true });
});

module.exports = router;
