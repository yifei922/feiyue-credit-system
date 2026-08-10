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
router.post('/content-check', async (req, res) => {
  const { type, content } = req.body || {};
  if (type !== 'text' || !content) return ok(res, { ok: true });
  try {
    const safe = await msgSecCheck(req.user.openid, content);
    ok(res, { ok: safe });
  } catch (e) {
    console.error('[content-check]', e.message);
    // 检测服务异常时软失败（不阻断正常发布）；如需严格可改 fail(403)
    ok(res, { ok: true, skipped: true });
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
    console.error('[media-check]', e.message);
    ok(res, { ok: true, skipped: true });
  }
});

// 举报动态
router.post('/posts/:id/report', async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS post_report(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      reporter_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
