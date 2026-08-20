const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { hashPassword } = require('../auth');
const { genTempPwd } = require('../constants');
const { ok, fail, fmtDate, paginate, setPageHeaders } = require('../util');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 列表：管理员/主理人/小组长看全班（分页，数组主体 + 响应头元信息）；成员仅看自己
// F6 软删除：默认过滤已删除（deleted_at IS NULL）
router.get('/', authMiddleware, async (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const includeDeleted = String(req.query.includeDeleted || '') === '1';
  const deletedFilter = includeDeleted ? '' : ' AND s.deleted_at IS NULL';
  let total, rows;
  if (req.user.role === 'STUDENT') {
    total = 1;
    rows = await db.prepare(`SELECT s.*, c.name AS className FROM student s LEFT JOIN clazz c ON s.class_id=c.id WHERE s.id=? AND s.deleted_at IS NULL`)
      .all(req.user.studentId);
  } else {
    total = (await db.prepare(`SELECT COUNT(*) AS c FROM student s WHERE 1=1${deletedFilter}`).get()).c;
    rows = await db.prepare(`SELECT s.*, c.name AS className FROM student s LEFT JOIN clazz c ON s.class_id=c.id WHERE 1=1${deletedFilter} ORDER BY s.id LIMIT ? OFFSET ?`).all(pageSize, offset);
  }
  const list = await Promise.all(rows.map(async r => ({
    id: r.id, studentNo: r.student_no, name: r.name, classId: r.class_id,
    totalCredits: r.total_credits, className: r.className
  })));
  const hasMore = offset + rows.length < total;
  setPageHeaders(res, { total, page, pageSize, hasMore });
  ok(res, list);
});

// 名单导出（管理员/主理人/小组长）：CSV（带 BOM 兼容 Excel）或 JSON，含总积分
router.get('/export', authMiddleware, requireRole('ADMIN', 'TEACHER', 'REP'), async (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  const rows = await db.prepare(
    `SELECT s.student_no AS studentNo, s.name, c.name AS className, s.total_credits AS totalCredits
     FROM student s LEFT JOIN clazz c ON s.class_id=c.id ORDER BY s.id`
  ).all();

  if (format === 'json') return ok(res, rows);

  const header = 'student_no,name,class_name,total_credits';
  const lines = [
    header,
    ...rows.map(r => `${r.studentNo || ''},${r.name},${r.className || ''},${r.totalCredits || 0}`)
  ];
  const fname = `students_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  // 同时给 ASCII fallback + RFC 5987 UTF-8 双版本，兼容老旧浏览器
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent('成员名单_' + fname)}`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

// 名单导入（管理员/主理人）：支持 JSON 数组或 CSV 文本
router.post('/import', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const body = req.body || {};
  let list = [];
  if (body.csv) {
    const lines = String(body.csv).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const start = /^(name|姓名|成员|编号|studentno|student_no)/i.test(lines[0] || '') ? 1 : 0;
    list = lines.slice(start).map(line => {
      const [name, studentNo] = line.split(/[,\t]/).map(x => x.trim());
      return { name, studentNo };
    });
  } else if (Array.isArray(body.students)) {
    list = body.students.map(s => ({ name: String(s.name || '').trim(), studentNo: String(s.studentNo || s.studentNo || '') }));
  }
  list = list.filter(s => s.name);

  if (list.length === 0) return fail(res, 400, '没有可导入的成员（请检查数据格式）');

  const classId = req.user.class_id || 1;
  const insStu = await db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)');
  const insUser = await db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id, must_change_pwd) VALUES(?,?,?,?,?,?,?)');
  let imported = 0;
  const importedRows = [];
  for (const s of list) {
    // 按编号去重
    const exist = await db.prepare('SELECT id FROM student WHERE student_no=?').get(s.studentNo);
    let studentId, isNew = false;
    if (exist) {
      studentId = exist.id;
    } else {
      const r = await insStu.run(s.name, s.studentNo, classId);
      studentId = r.lastInsertRowid;
      isNew = true;
    }
    // 关联账号（若尚无对应 STUDENT 账号）
    const hasUser = await db.prepare("SELECT id FROM sys_user WHERE role='STUDENT' AND student_id=?").get(studentId);
    if (!hasUser) {
      const username = 'stu' + String(studentId).padStart(2, '0');
      await insUser.run(username, hashPassword(genTempPwd()), s.name, 'STUDENT', classId, studentId, 1);
    }
    if (isNew) imported++;
    importedRows.push({ id: studentId, name: s.name, studentNo: s.studentNo });
  }

  recordLog(req.user, 'IMPORT', 'student', null, null, { count: imported, sample: importedRows.slice(0, 5) });
  ok(res, { imported, total: list.length, rows: importedRows });
});

// 重置成员登录密码（管理员/主理人/小组长）；不传 password 则生成随机临时密码
router.post('/:id/reset-password', authMiddleware, requireRole('ADMIN', 'TEACHER', 'REP'), async (req, res) => {
  const student = await db.prepare('SELECT * FROM student WHERE id=?').get(req.params.id);
  if (!student) return fail(res, 404, '成员不存在');
  const user = await db.prepare("SELECT * FROM sys_user WHERE role='STUDENT' AND student_id=?").get(student.id);
  if (!user) return fail(res, 404, '该成员尚无登录账号');
  const custom = String(req.body?.password || '').trim();
  const newPwd = custom || genTempPwd();
  if (newPwd.length < 6) return fail(res, 400, '密码至少 6 位');
  await db.prepare('UPDATE sys_user SET password=?, must_change_pwd=1 WHERE id=?').run(hashPassword(newPwd), user.id);
  recordLog(req.user, 'UPDATE', 'sys_user', user.id, { username: user.username }, { action: 'reset-password' });
  ok(res, { ok: true, username: user.username, password: newPwd, temp: !custom });
});

// 批量重置多个成员的密码（统一密码；不传则各自生成随机临时密码）
// 限管理员/主理人。前端循环调用单条接口也可，本接口用于事务式批量以减少请求往返。
router.post('/batch-reset-password', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => Number.isInteger(+x)) : [];
  if (ids.length === 0) return fail(res, 400, '请选择至少一名成员');
  if (ids.length > 200) return fail(res, 400, '单次最多 200 人');
  const custom = String(req.body?.password || '').trim();
  const useUniform = !!custom && custom.length >= 6;
  const results = [];
  for (const id of ids) {
    const student = await db.prepare("SELECT * FROM student WHERE id=? AND deleted_at IS NULL").get(id);
    if (!student) { results.push({ id, ok: false, error: '成员不存在或已删除' }); continue; }
    const user = await db.prepare("SELECT * FROM sys_user WHERE role='STUDENT' AND student_id=?").get(student.id);
    if (!user) { results.push({ id, ok: false, error: '该成员尚无登录账号' }); continue; }
    const newPwd = useUniform ? custom : genTempPwd();
    await db.prepare('UPDATE sys_user SET password=?, must_change_pwd=1 WHERE id=?').run(hashPassword(newPwd), user.id);
    results.push({ id, ok: true, username: user.username, password: newPwd, temp: !useUniform });
  }
  recordLog(req.user, 'UPDATE', 'sys_user', null, null, { action: 'batch-reset-password', count: results.length, uniform: useUniform });
  const succeeded = results.filter((r) => r.ok).length;
  ok(res, { ok: true, total: ids.length, succeeded, failed: ids.length - succeeded, results });
});

// 新增单个成员（老师/管理员）；可指定登录密码，留空则生成随机临时密码
router.post('/', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { name, studentNo, password } = req.body || {};
  if (!name) return fail(res, 400, '请填写成员姓名');
  const r = await db.prepare('INSERT INTO student(name, student_no, class_id) VALUES(?,?,?)').run(name, studentNo || '', req.user.class_id || 1);
  const studentId = r.lastInsertRowid;
  const custom = String(password || '').trim();
  const newPwd = custom || genTempPwd();
  if (newPwd.length < 6) return fail(res, 400, '密码至少 6 位');
  const username = 'stu' + String(studentId).padStart(2, '0');
  await db.prepare('INSERT INTO sys_user(username, password, name, role, class_id, student_id, must_change_pwd) VALUES(?,?,?,?,?,?,?)')
    .run(username, hashPassword(newPwd), name, 'STUDENT', req.user.class_id || 1, studentId, 1);
  recordLog(req.user, 'INSERT', 'student', studentId, null, { name, studentNo, temp: !custom });
  ok(res, { id: studentId, name, studentNo, username, password: newPwd, temp: !custom });
});

// 更新
router.put('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { name, studentNo } = req.body || {};
  const before = await db.prepare('SELECT * FROM student WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '成员不存在');
  await db.prepare('UPDATE student SET name=?, student_no=? WHERE id=?').run(name ?? before.name, studentNo ?? before.student_no, req.params.id);
  await db.prepare('UPDATE sys_user SET name=? WHERE role=? AND student_id=?').run(name ?? before.name, 'STUDENT', req.params.id);
  recordLog(req.user, 'UPDATE', 'student', req.params.id, before, { name, studentNo });
  ok(res, { ok: true });
});

// 删除（F6 软删除，默认）：标记 deleted_at 而非真删，便于 30 天内回收站恢复
// ?hard=1 时彻底物理删除（同步删 STUDENT 角色 sys_user 账号），不可恢复
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const hard = String(req.query.hard || '') === '1';
  const sql = hard ? 'SELECT * FROM student WHERE id=?' : 'SELECT * FROM student WHERE id=? AND deleted_at IS NULL';
  const before = await db.prepare(sql).get(req.params.id);
  if (!before) return fail(res, 404, hard ? '成员不存在' : '成员不存在或已删除');
  if (hard) {
    await db.prepare("DELETE FROM sys_user WHERE role='STUDENT' AND student_id=?").run(req.params.id);
    await db.prepare('DELETE FROM student WHERE id=?').run(req.params.id);
    recordLog(req.user, 'DELETE_HARD', 'student', req.params.id, before, null);
    ok(res, { ok: true, hard: true });
  } else {
    await db.prepare('UPDATE student SET deleted_at=NOW() WHERE id=?').run(req.params.id);
    recordLog(req.user, 'DELETE', 'student', req.params.id, before, null);
    ok(res, { ok: true, recoverable: true });
  }
});

// 恢复软删除的成员（回收站恢复入口）
router.post('/:id/restore', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const before = await db.prepare('SELECT * FROM student WHERE id=? AND deleted_at IS NOT NULL').get(req.params.id);
  if (!before) return fail(res, 404, '该成员未被删除，无需恢复');
  await db.prepare('UPDATE student SET deleted_at=NULL WHERE id=?').run(req.params.id);
  recordLog(req.user, 'UPDATE', 'student', req.params.id, before, { action: 'restore' });
  ok(res, { ok: true });
});

module.exports = router;
