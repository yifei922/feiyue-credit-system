// 微信小程序服务端 SDK 封装
// - code2Session: code 换 openid / session_key
// - 安全约束: AppSecret 只能从环境变量 WX_APP_SECRET 读，绝不入库不入代码
// - 本地开发 (NODE_ENV!=='production' 或显式 WX_MOCK=1) 且未配置真实 AppSecret 时，
//   自动启用 MOCK 登录：用 code 派生稳定 openid，方便在微信开发者工具里预览联调。
//   生产环境若仍缺失 AppSecret，则返回 WX_SECRET_MISSING 让 wx-login 接口给出清晰提示。
const https = require('https');
const crypto = require('crypto');

const APP_ID  = process.env.WX_APP_ID || 'wx0fe78d74fdc47c1b';
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

module.exports = { code2Session, APP_ID, MOCK_MODE };
