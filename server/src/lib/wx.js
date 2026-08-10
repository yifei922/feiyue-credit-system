// 微信小程序服务端 SDK 封装
// - code2Session: code 换 openid / session_key
// - 安全约束: AppSecret 只能从环境变量 WX_APP_SECRET 读，绝不入库不入代码
// - 本地开发 (NODE_ENV!=='production' 或显式 WX_MOCK=1) 且未配置真实 AppSecret 时，
//   自动启用 MOCK 登录：用 code 派生稳定 openid，方便在微信开发者工具里预览联调。
//   生产环境若仍缺失 AppSecret，则返回 WX_SECRET_MISSING 让 wx-login 接口给出清晰提示。
const https = require('https');
const crypto = require('crypto');

const APP_ID  = process.env.WX_APP_ID || 'wx64664e7fa8d4f747';
const APP_SECRET = process.env.WX_APP_SECRET;

const SECRET_MISSING = !APP_SECRET || APP_SECRET.includes('请替换');
const IS_PROD = process.env.NODE_ENV === 'production';
// 生产环境(NODE_ENV=production)一律关闭 MOCK，避免「漏配 AppSecret + 漏设 NODE_ENV」时被任意 code 登录；
// 本地(非 production)在「未配真实 AppSecret 或显式 WX_MOCK=1」时启用 MOCK，方便预览。
const MOCK_MODE = !IS_PROD && (process.env.WX_MOCK === '1' || SECRET_MISSING);

function mockOpenid(code) {
  const h = crypto.createHash('sha256').update('mock:' + (code || 'x')).digest('hex').slice(0, 24);
  return 'mock_openid_' + h;
}

/**
 * 用 wx.login() 拿到的 code 换 openid / session_key
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/api-backend/code2Session.html
 * @param {string} code
 * @returns {Promise<{openid:string,session_key:string,unionid?:string,mock?:boolean}>}
 */
function code2Session(code) {
  return new Promise((resolve, reject) => {
    // 本地开发且未配置真实 AppSecret → 派生稳定 openid，便于预览
    if (SECRET_MISSING) {
      if (MOCK_MODE) {
        console.warn('[wx] WX_APP_SECRET 未配置，已启用「本地 MOCK 登录」（仅开发环境）。'
          + ' 上线前请在 server/.env 填入真实 AppSecret 并删除 WX_MOCK=1，否则真实微信用户无法登录。');
        return resolve({ openid: mockOpenid(code), session_key: 'mock_session_key', mock: true });
      }
      const err = new Error('WX_APP_SECRET 环境变量未配置');
      err.code = 'WX_SECRET_MISSING';
      return reject(err);
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${encodeURIComponent(APP_SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const req = https.get(url, (res) => {
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
    });
    req.setTimeout(5000, () => req.destroy(new Error('wx code2Session timeout (5s)')));
    req.on('error', (e) => reject(e));
  });
}

module.exports = { code2Session, APP_ID, MOCK_MODE, getAccessToken, msgSecCheck, imgSecCheck };

// ── 内容安全：access_token 缓存 ──
let _tokenCache = { token: null, exp: 0 };
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (_tokenCache.token && _tokenCache.exp > now + 5 * 60 * 1000) return resolve(_tokenCache.token);
    if (!APP_SECRET) return reject(new Error('WX_APP_SECRET 未配置，无法获取 access_token'));
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${encodeURIComponent(APP_SECRET)}`;
    const req = https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.access_token) {
            _tokenCache = { token: body.access_token, exp: now + (body.expires_in || 7200) * 1000 };
            resolve(body.access_token);
          } else reject(new Error(body.errmsg || '获取 access_token 失败'));
        } catch (e) { reject(new Error('access_token 返回非 JSON')); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('getAccessToken timeout')));
    req.on('error', reject);
  });
}

/**
 * 文本违规检测（msgSecCheck）。命中风险返回 false；通过返回 true；接口异常抛出。
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/api-backend/openapi/sec-check/sec-check-service.msgSecCheck.html
 */
function msgSecCheck(openid, content) {
  return getAccessToken().then((token) => new Promise((resolve, reject) => {
    if (!content || !content.trim()) return resolve(true); // 空内容直接放行
    const payload = JSON.stringify({ openid: openid || '', scene: 2, version: 2, content });
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: `/wxa/msg_sec_check?access_token=${token}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.errcode === 0) return resolve(true);
          if (body.errcode === 87014) return resolve(false); // 命中风险内容
          reject(new Error(body.errmsg || 'msgSecCheck 失败'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('msgSecCheck timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  }));
}

/**
 * 图片违规检测（imgSecCheck）。命中风险返回 false；通过返回 true；接口异常抛出。
 * @param {Buffer} buf 图片二进制
 * @param {string} filename 形如 'a.png'
 */
function imgSecCheck(buf, filename) {
  return getAccessToken().then((token) => new Promise((resolve, reject) => {
    if (!buf || !buf.length) return resolve(true);
    const boundary = '----WXSEC' + Date.now();
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename || 'file.png'}"\r\nContent-Type: image/png\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buf, tail]);
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: `/wxa/img_sec_check?access_token=${token}`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      timeout: 8000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const b = JSON.parse(Buffer.concat(chunks).toString());
          if (b.errcode === 0) return resolve(true);
          if (b.errcode === 87014) return resolve(false);
          reject(new Error(b.errmsg || 'imgSecCheck 失败'));
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('imgSecCheck timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  }));
}
