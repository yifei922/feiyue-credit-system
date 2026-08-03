// 小程序鉴权路由：微信一键登录 + 账号密码兜底
// 返回 JWT 与 Web 端共用同一套 auth 体系，前端无需做特殊处理
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { code2Session } = require('../lib/wx');
const { signToken } = require('../auth');

// 工具：从 sys_user + student 取最小必要字段（与 Web 端 /api/auth/login 保持一致）
function userPayload(u) {
  return {
    id: u.id, username: u.username, name: u.name || u.username,
    role: u.role, studentId: u.student_id || null, classId: u.class_id || null,
    avatar: u.avatar || null, openid: u.openid || null,
  };
}

/**
 * 微信一键登录
 * POST /api/mp/auth/wx-login
 * body: { code: string, nickname?: string, avatarUrl?: string }
 * 流程：
 *   1) code 换 openid
 *   2) 查 sys_user.openid 是否存在
 *   3) 存在：返回 JWT（已绑定）
 *   4) 不存在：自动建账号（默认角色 STUDENT，username=openid 前 12 位；后续用户在个人中心"绑定学号"）
 */
router.post('/wx-login', async (req, res) => {
  try {
    const { code, nickname, avatarUrl } = req.body || {};
    if (!code) return res.status(400).json({ code: 400, message: '缺少 code' });

    let openid;
    try {
      const r = await code2Session(code);
      openid = r.openid;
    } catch (e) {
      if (e.code === 'WX_SECRET_MISSING') {
        return res.status(503).json({ code: 503, message: '服务端未配置微信 AppSecret，请联系管理员' });
      }
      return res.status(400).json({ code: 400, message: '微信登录失败：' + (e.message || '') });
    }

    // 1) 已有 openid → 直接登录
    const existing = db.prepare('SELECT * FROM sys_user WHERE openid=?').get(openid);
    if (existing) {
      // 可选：更新昵称头像
      if ((nickname && !existing.name) || (avatarUrl && !existing.avatar)) {
        db.prepare('UPDATE sys_user SET name=COALESCE(?,name), avatar=COALESCE(?,avatar) WHERE id=?')
          .run(nickname || null, avatarUrl || null, existing.id);
      }
      const u = db.prepare('SELECT * FROM sys_user WHERE id=?').get(existing.id);
      const token = signToken(userPayload(u));
      return res.json({ code: 0, message: 'success', data: { token, user: userPayload(u), bound: true } });
    }

    // 2) 未绑定 → 自动建账号（临时用户名 = wx_<openid前10>），等用户去个人中心绑定学号
    const tmpUsername = 'wx_' + openid.slice(0, 10);
    const dup = db.prepare('SELECT id FROM sys_user WHERE username=?').get(tmpUsername);
    if (dup) {
      // 极端冲突（极小概率）：把 openid 绑到这个账号
      db.prepare('UPDATE sys_user SET openid=? WHERE id=?').run(openid, dup.id);
    } else {
      const name = nickname || '微信用户';
      db.prepare(`INSERT INTO sys_user(username, password, name, role, class_id, student_id, openid, avatar)
                  VALUES(?,?,?,?,?,?,?,?)`)
        .run(tmpUsername, '!wx_temp', name, 'STUDENT', 1, null, openid, avatarUrl || null);
    }
    const u = db.prepare('SELECT * FROM sys_user WHERE openid=?').get(openid);
    const token = signToken(userPayload(u));
    return res.json({
      code: 0, message: 'success',
      data: { token, user: userPayload(u), bound: false, hint: '首次登录，请在个人中心绑定学号以关联班级数据' }
    });
  } catch (e) {
    console.error('[mp/wx-login]', e);
    res.status(500).json({ code: 500, message: '登录失败：' + (e.message || '') });
  }
});

module.exports = router;