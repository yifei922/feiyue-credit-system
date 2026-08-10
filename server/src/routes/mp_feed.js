// 动态（社交）路由
// - GET    /api/mp/feed?page=N          动态信息流
// - POST   /api/mp/posts                发布
// - DELETE /api/mp/posts/:id           删除自己的
// - POST   /api/mp/posts/:id/like       点赞/取消
// - GET    /api/mp/posts/:id/comments   评论列表
// - POST   /api/mp/posts/:id/comments   发表评论
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');
const { msgSecCheck } = require('../lib/wx');

async function attachStats(posts, viewerId) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const likes = await db.prepare(`SELECT post_id, COUNT(*) AS c FROM post_like WHERE post_id IN (${placeholders}) GROUP BY post_id`).all(...ids);
  const comments = await db.prepare(`SELECT post_id, COUNT(*) AS c FROM post_comment WHERE post_id IN (${placeholders}) GROUP BY post_id`).all(...ids);
  const liked = viewerId ? await db.prepare(`SELECT post_id FROM post_like WHERE user_id=? AND post_id IN (${placeholders})`).all(viewerId, ...ids) : [];
  const likedSet = new Set(liked.map((x) => x.post_id));
  const likeMap = Object.fromEntries(likes.map((l) => [l.post_id, l.c]));
  const cmtMap = Object.fromEntries(comments.map((c) => [c.post_id, c.c]));
  posts.forEach((p) => {
    p.like_count = likeMap[p.id] || 0;
    p.comment_count = cmtMap[p.id] || 0;
    p.liked_by_me = likedSet.has(p.id);
    try { p.images = JSON.parse(p.images || '[]'); } catch (_) { p.images = []; }
  });
  return posts;
}

router.get('/feed', async (req, res) => {
  const lim = 10;
  const page = Math.max(1, +req.query.page || 1);
  const list = await db.prepare(`SELECT p.*, u.name AS user_name, u.avatar AS user_avatar, u.role AS user_role
                           FROM post p JOIN sys_user u ON p.user_id = u.id
                           ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
    .all(lim, (page - 1) * lim);
  attachStats(list, req.user.id);
  ok(res, { list, hasMore: list.length === lim });
});

router.post('/posts', async (req, res) => {
  const { text, images, video_url, resource_id } = req.body || {};
  if (!text && !(images && images.length) && !video_url) return fail(res, 400, '内容不能为空');
  if (text && text.length > 1000) return fail(res, 400, '文字过长（≤1000字）');
  if (images && images.length > 9) return fail(res, 400, '最多 9 张图');
  // 内容安全：发布前文本违规检测
  try {
    const safe = await msgSecCheck(req.user.openid, text || '');
    if (!safe) return fail(res, 403, '内容包含违规信息，发布失败');
  } catch (e) {
    console.error('[feed] msgSecCheck 异常:', e.message);
    return fail(res, 500, '内容安全检测失败，请稍后重试');
  }
  const info = await db.prepare(`INSERT INTO post(user_id, text, images, video_url, resource_id)
                          VALUES(?,?,?,?,?)`)
    .run(req.user.id, text || null, JSON.stringify(images || []), video_url || null, resource_id || null);
  ok(res, { id: info.lastInsertRowid });
});

router.delete('/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = await db.prepare('SELECT user_id FROM post WHERE id=?').get(id);
  if (!p) return fail(res, 404, '动态不存在');
  if (p.user_id !== req.user.id && req.user.role !== 'ADMIN') return fail(res, 403, '无权删除');
  await db.prepare('DELETE FROM post_like WHERE post_id=?').run(id);
  await db.prepare('DELETE FROM post_comment WHERE post_id=?').run(id);
  await db.prepare('DELETE FROM post WHERE id=?').run(id);
  ok(res, { ok: true });
});

router.post('/posts/:id/like', async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.prepare('SELECT id FROM post WHERE id=?').get(id)) return fail(res, 404, '动态不存在');
  const has = await db.prepare('SELECT 1 FROM post_like WHERE post_id=? AND user_id=?').get(id, req.user.id);
  if (has) {
    await db.prepare('DELETE FROM post_like WHERE post_id=? AND user_id=?').run(id, req.user.id);
    ok(res, { liked: false });
  } else {
    await db.prepare('INSERT INTO post_like(post_id, user_id) VALUES(?,?)').run(id, req.user.id);
    ok(res, { liked: true });
  }
});

router.get('/posts/:id/comments', async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.prepare(`SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
                           FROM post_comment c JOIN sys_user u ON c.user_id = u.id
                           WHERE c.post_id=? ORDER BY c.id ASC`).all(id);
  ok(res, { list });
});

router.post('/posts/:id/comments', async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.prepare('SELECT id FROM post WHERE id=?').get(id)) return fail(res, 404, '动态不存在');
  const { text } = req.body || {};
  if (!text || !text.trim()) return fail(res, 400, '评论不能为空');
  if (text.length > 500) return fail(res, 400, '评论过长（≤500字）');
  // 内容安全：评论前文本违规检测
  try {
    const safe = await msgSecCheck(req.user.openid, text);
    if (!safe) return fail(res, 403, '评论包含违规信息，发送失败');
  } catch (e) {
    console.error('[feed] comment msgSecCheck 异常:', e.message);
    return fail(res, 500, '内容安全检测失败，请稍后重试');
  }
  const info = await db.prepare('INSERT INTO post_comment(post_id, user_id, text) VALUES(?,?,?)').run(id, req.user.id, text.trim());
  ok(res, { id: info.lastInsertRowid });
});

module.exports = router;