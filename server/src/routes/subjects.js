const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail, paginate, setPageHeaders } = require('../util');
const authMiddleware = require('../middleware/auth');
const { requireRole, getManagedSubjectIds } = require('../middleware/rbac');
const { recordLog } = require('../services/log');

// 列表（分页；主体返回数组，分页元信息放响应头，网页端/小程序端均兼容）
// 支持 ?platform=WEB|MP 过滤（双科目体系隔离：Web=初二学科，MP=中性兴趣科目）
// 默认 MP：兼容小程序旧客户端（不传 platform 仍返回中性兴趣科目），Web 端显式传 platform=WEB
router.get('/', authMiddleware, async (req, res) => {
  const { page, pageSize, offset } = paginate(req.query);
  const platform = (req.query.platform || 'MP').toUpperCase();
  let total, rows;
  if (req.user.role === 'REP') {
    const ids = await getManagedSubjectIds(req.user);
    ids.filter((id) => true); // 占位；REP 管理范围不强制按平台过滤
    total = ids.length;
    if (ids.length === 0) rows = [];
    else rows = await db.prepare(`SELECT * FROM subject WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id LIMIT ? OFFSET ?`).all(...ids, pageSize, offset);
  } else {
    total = (await db.prepare('SELECT COUNT(*) AS c FROM subject WHERE platform=?').get(platform)).c;
    rows = await db.prepare('SELECT * FROM subject WHERE platform=? ORDER BY id LIMIT ? OFFSET ?').all(platform, pageSize, offset);
  }
  const result = await Promise.all(rows.map(async s => {
    const reps = await db.prepare(`SELECT u.id, u.name FROM subject_rep sr JOIN sys_user u ON sr.user_id=u.id WHERE sr.subject_id=?`).all(s.id);
    return { id: s.id, name: s.name, classId: s.class_id, teacherId: s.teacher_id, platform: s.platform || platform, repUserIds: await Promise.all(reps.map(async r => r.id)), repNames: await Promise.all(reps.map(async r => r.name)) };
  }));
  const hasMore = offset + rows.length < total;
  setPageHeaders(res, { total, page, pageSize, hasMore });
  ok(res, result);
});

// 新增（管理员/主理人）
router.post('/', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { name, classId, teacherId, platform } = req.body || {};
  if (!name) return fail(res, 400, '请填写科目名称');
  const plat = (platform || 'WEB').toUpperCase();
  const r = await db.prepare('INSERT INTO subject(name, class_id, teacher_id, platform) VALUES(?,?,?,?)').run(name, classId || req.user.class_id || 1, teacherId || null, plat);
  recordLog(req.user, 'INSERT', 'subject', r.lastInsertRowid, null, { name, platform: plat });
  ok(res, { id: r.lastInsertRowid, name, platform: plat });
});

// 设置课代表（管理员/教师）—— 双身份自动转换（任务 3 核验整改，2026-09-07）
// 规则：
//   1) 新选中的「学生」账号 → role 自动升级为 REP（课代表），student_id 保留 → 登录后自动获得
//      「课代表 + 学生」双身份（rbac 角色继承 REP ⊃ STUDENT，可布置任务也可提交作业）
//   2) 被移除的课代表：若 role=REP 且不再担任任何科目课代表 → 自动恢复为 STUDENT（有学生档案时）
//      或 TEACHER（无学生档案时，即原教师账号兼任课代表的情形）
//   3) 教师兼任课代表不改变其 TEACHER 角色
router.post('/:id/reps', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const subjectId = req.params.id;
  const subject = await db.prepare('SELECT * FROM subject WHERE id=?').get(subjectId);
  if (!subject) return fail(res, 404, '科目不存在');
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(Number) : [];

  // 变更前的课代表列表（用于差集计算）
  const beforeRows = await db.prepare('SELECT user_id FROM subject_rep WHERE subject_id=?').all(subjectId);
  const beforeIds = beforeRows.map((r) => r.user_id);
  const addedIds = userIds.filter((id) => !beforeIds.includes(id));
  const removedIds = beforeIds.filter((id) => !userIds.includes(id));

  await db.prepare('DELETE FROM subject_rep WHERE subject_id=?').run(subjectId);
  const ins = await db.prepare('INSERT IGNORE INTO subject_rep(subject_id, user_id) VALUES(?,?)');
  for (const uid of userIds) {
    await ins.run(subjectId, uid);
  }

  // ── 角色同步：新晋课代表（学生 → REP）──
  const promoted = [];
  for (const uid of addedIds) {
    const u = await db.prepare('SELECT id, role, student_id FROM sys_user WHERE id=?').get(uid);
    if (!u) continue;
    if (u.role === 'STUDENT') {
      await db.prepare("UPDATE sys_user SET role='REP' WHERE id=?").run(uid);
      promoted.push(u.id);
    }
  }

  // ── 角色同步：被移除的课代表（不再担任任何科目 → 恢复原身份）──
  const demoted = [];
  for (const uid of removedIds) {
    const u = await db.prepare('SELECT id, role, student_id FROM sys_user WHERE id=?').get(uid);
    if (!u || u.role !== 'REP') continue;
    const still = await db.prepare('SELECT COUNT(*) AS c FROM subject_rep WHERE user_id=?').get(uid);
    if (still.c === 0) {
      const backRole = u.student_id ? 'STUDENT' : 'TEACHER';
      await db.prepare('UPDATE sys_user SET role=? WHERE id=?').run(backRole, uid);
      demoted.push({ id: uid, backRole });
    }
  }

  recordLog(req.user, 'UPDATE', 'subject_rep', subjectId, { userIds: beforeIds }, { userIds, promoted, demoted });
  ok(res, { ok: true, repCount: userIds.length, promoted, demoted });
});

// 更新
router.put('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const { name, teacherId } = req.body || {};
  const before = await db.prepare('SELECT * FROM subject WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '科目不存在');
  await db.prepare('UPDATE subject SET name=?, teacher_id=? WHERE id=?').run(name ?? before.name, teacherId ?? before.teacher_id, req.params.id);
  recordLog(req.user, 'UPDATE', 'subject', req.params.id, before, { name, teacherId });
  ok(res, { ok: true });
});

// 删除
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
  const before = await db.prepare('SELECT * FROM subject WHERE id=?').get(req.params.id);
  if (!before) return fail(res, 404, '科目不存在');
  await db.prepare('DELETE FROM subject_rep WHERE subject_id=?').run(req.params.id);
  await db.prepare('DELETE FROM subject WHERE id=?').run(req.params.id);
  recordLog(req.user, 'DELETE', 'subject', req.params.id, before, null);
  ok(res, { ok: true });
});

module.exports = router;
