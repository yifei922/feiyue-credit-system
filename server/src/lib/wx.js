// 微信小程序服务端 SDK 封装
// - code2Session: code 换 openid / session_key
// - 安全约束: AppSecret 只能从环境变量 WX_APP_SECRET 读，绝不入库不入代码
// - 注意: jscode2session 是高频调用，需要缓存 access_token 吗？不需要，code2session 用的是 appsecret 但不需要 access_token
const https = require('https');

const APP_ID  = process.env.WX_APP_ID || 'wx0fe78d74fdc47c1b';
const APP_SECRET = process.env.WX_APP_SECRET;  // 必须从环境变量注入，运行时缺失则 wx-login 接口返回 503

/**
 * 用 wx.login() 拿到的 code 换 openid / session_key
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/api-backend/code2Session.html
 * @param {string} code
 * @returns {Promise<{openid:string,session_key:string,unionid?:string}>}
 */
function code2Session(code) {
  return new Promise((resolve, reject) => {
    if (!APP_SECRET) {
      const err = new Error('WX_APP_SECRET 环境变量未配置');
      err.code = 'WX_SECRET_MISSING';
      return reject(err);
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${encodeURIComponent(APP_SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          const body = JSON.parse(raw);
          if (body.openid) resolve(body);
          else reject(new Error(body.errmsg || 'code2Session 失败'));
        } catch (e) {
          reject(new Error('code2Session 返回非 JSON: ' + raw.slice(0, 200)));
        }
      });
    }).on('error', (e) => reject(e));
  });
}

module.exports = { code2Session, APP_ID };