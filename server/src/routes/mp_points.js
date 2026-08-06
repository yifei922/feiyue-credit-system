// 积分路由（小程序专用）
// - GET  /api/mp/me/points      当前积分余额
// - GET  /api/mp/me/points/logs 积分流水（待扩展）
// - POST /api/mp/points/ad-reward 看完激励视频广告后调用，加积分（前端 wx.adRewardedVideoAd 后回调）
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ok, fail } = require('../util');

const AD_REWARD_POINTS = 5;     // 看完一次激励视频奖励 5 积分
const AD_DAILY_LIMIT = 20;      // 每日上限

router.get('/me/points', (req, res) => {
  const r = db.prepare('SELECT * FROM user_points WHERE user_id=?').get(req.user.id);
  ok(res, {
    points: r ? r.points : 0,
    totalEarned: r ? r.total_earned : 0,
    adRewardPoints: AD_REWARD_POINTS,
    adDailyLimit: AD_DAILY_LIMIT,
  });
});

router.post('/points/ad-reward', (req, res) => {
  const u = req.user;
  const day = new Date().toISOString().slice(0, 10);
  const used = db.prepare(`SELECT COUNT(*) AS c FROM ad_view_log WHERE user_id=? AND day=? AND resource_id IS NULL`).get(u.id, day).c;
  if (used >= AD_DAILY_LIMIT) return fail(res, 429, '今日广告奖励已达上限');
  db.prepare('INSERT INTO ad_view_log(user_id, resource_id, day) VALUES(?,NULL,?)').run(u.id, day);
  // 累加积分
  const cur = db.prepare('SELECT points, total_earned FROM user_points WHERE user_id=?').get(u.id);
  if (cur) {
    db.prepare("UPDATE user_points SET points=points+?, total_earned=total_earned+?, updated_at=datetime('now') WHERE user_id=?")
      .run(AD_REWARD_POINTS, AD_REWARD_POINTS, u.id);
  } else {
    db.prepare('INSERT INTO user_points(user_id, points, total_earned) VALUES(?,?,?)')
      .run(u.id, AD_REWARD_POINTS, AD_REWARD_POINTS);
  }
  ok(res, { earned: AD_REWARD_POINTS });
});

module.exports = router;