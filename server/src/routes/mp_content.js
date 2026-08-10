// 内容安全路由（UGC 合规）
// - POST /api/mp/content-check  { type:'text', content } 文本违规检测代理（前端不直接持有密钥）
// - POST /api/mp/media-check    { type:'image', filePath } 图片违规检测代理（服务端本地文件）
// - POST /api/mp/posts/:id/report { reason } 举报动态（配合管理员删除形成闭环）
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { db } = require('../db');
const { ok, fail } = require('../util');
const { msgSecCheck, imgSecCheck } = require('../lib/wx');

// 文本检测
// 合规策略：检测服务异常时返回 503，让前端引导重试或人工审核，避免静默放行导致违规内容入库。
router.post('/content-check', async (req, res) => {
  const { type, content } = req.body || {};
  if (type !== 'text' || !content) return ok(res, { ok: true });
  try {
    const safe = await msgSecCheck(req.user.openid, content);
    ok(res, { ok: safe });
  } catch (e) {
    console.error('[content-check] 安检服务异常:', e.message);
    fail(res, 503, '内容安全检测暂不可用，请稍后再试');
  }
});

// 图片检测（传服务端本地路径）
router.post('/media-check', async (req, res) => {
  const { type, filePath } = req.body || {};
  if (type !== 'image' || !filePath) return ok(res, { ok: true });
  try {
    const buf = fs.readFileSync(filePath);
    const safe = await imgSecCheck(buf, String(filePath).split('/').pop());
    ok(res, { ok: safe });
  } catch (e) {
    console.error('[media-check] 安检服务异常:', e.message);
    fail(res, 503, '图片内容检测暂不可用，请稍后再试');
  }
});

// 举报动态（MySQL 语法：AUTO_INCREMENT）
router.post('/posts/:id/report', async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS post_report(
      id INT PRIMARY KEY AUTO_INCREMENT,
      post_id INT NOT NULL,
      reporter_id INT NOT NULL,
      reason TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INT
    )`);
    await db.prepare('INSERT INTO post_report(post_id, reporter_id, reason) VALUES(?,?,?)')
      .run(id, req.user.id, reason || '');
    ok(res, { ok: true });
  } catch (e) {
    console.error('[report]', e.message);
    fail(res, 500, '举报失败');
  }
});

module.exports = router;

// 举报管理：列出待处理举报 + 标记已处理（仅 ADMIN）
router.get('/admin/reports', async (req, res) => {
  if (req.user.role !== 'ADMIN') return fail(res, 403, '无权操作');
  await db.exec(`CREATE TABLE IF NOT EXISTS post_report(
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by INT
  )`).catch(() => {});
  const list = await db.prepare(`SELECT r.id, r.post_id, r.reporter_id, r.reason, r.status, r.created_at,
                                        u.name AS reporter_name,
                                        p.text AS post_text
                                 FROM post_report r
                                 LEFT JOIN sys_user u ON r.reporter_id=u.id
                                 LEFT JOIN post p ON r.post_id=p.id
                                 WHERE r.status='PENDING'
                                 ORDER BY r.id DESC LIMIT 200`).all();
  ok(res, list);
});

router.post('/admin/reports/:id/resolve', async (req, res) => {
  if (req.user.role !== 'ADMIN') return fail(res, 403, '无权操作');
  await db.exec(`CREATE TABLE IF NOT EXISTS post_report(
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    reporter_id INT NOT NULL,
    reason TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by INT
  )`).catch(() => {});
  const id = Number(req.params.id);
  await db.prepare(`UPDATE post_report SET status='RESOLVED', resolved_at=CURRENT_TIMESTAMP, resolved_by=? WHERE id=?`).run(req.user.id, id);
  ok(res, { ok: true });
});
