// app.js - 全局入口与状态
const { getToken, setToken, clearAuth } = require('./utils/auth.js');
const { API_BASE, USE_CLOUD_RUN, CLOUD_RUN_ENV, CLOUD_RUN_SERVICE } = require('./config/env.js');

App({
  globalData: {
    apiBase: API_BASE, // 后端地址（见 config/env.js）
    user: null,
    token: '',
    systemInfo: null,
    // 轻量埋点（#6 可观测）：接口耗时/失败率 + 页面曝光，供调试面板查看
    telemetry: { apis: [], pages: [], max: 200 },
  },

  onLaunch() {
    // 读取本地 token
    const t = wx.getStorageSync('token');
    const u = wx.getStorageSync('user');
    if (t) this.globalData.token = t;
    if (u) this.globalData.user = u;
    this.globalData.systemInfo = wx.getSystemInfoSync();
  },

  // 一键登录：先 wx.login() 拿 code，再 POST /api/mp/auth/wx-login
  async wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async ({ code }) => {
          if (!code) return reject(new Error('wx.login 未返回 code'));
          try {
            const r = await this.apiPost('/api/mp/auth/wx-login', { code }, /* noToken */ true);
            if (r.code !== 0) return reject(new Error(r.message || '登录失败'));
            setToken(r.data.token);
            wx.setStorageSync('user', r.data.user);
            this.globalData.token = r.data.token;
            this.globalData.user = r.data.user;
            // 首次登录强制改密
            if (r.data.user && r.data.user.mustChangePwd) {
              wx.reLaunch({ url: '/pages/me/change-pwd?forced=1' });
            }
            resolve(r.data);
          } catch (e) { reject(e); }
        },
        fail: reject,
      });
    });
  },

  // 账号密码登录（Web 端同样接口，便于老用户登录）
  async pwdLogin(username, password) {
    const r = await this.apiPost('/api/auth/login', { username, password }, /* noToken */ true);
    if (r.code !== 0) throw new Error(r.message || '登录失败');
    setToken(r.data.token);
    wx.setStorageSync('user', r.data.user);
    this.globalData.token = r.data.token;
    this.globalData.user = r.data.user;
    // 首次登录强制改密
    if (r.data.user && r.data.user.mustChangePwd) {
      wx.reLaunch({ url: '/pages/me/change-pwd?forced=1' });
    }
    return r.data;
  },

  // 通用 POST（带 token；noToken=true 不带 token，用于登录）
  apiPost(path, data, noToken = false) {
    return this._api(path, 'POST', data, noToken);
  },
  apiGet(path, params, noToken = false) {
    const q = params ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    return this._api(path + q, 'GET', null, noToken);
  },
  apiDelete(path, data, noToken = false) {
    return this._api(path, 'DELETE', data || null, noToken);
  },
  apiPut(path, data, noToken = false) {
    return this._api(path, 'PUT', data || null, noToken);
  },

  _api(path, method, data, noToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (!noToken && this.globalData.token) headers['Authorization'] = 'Bearer ' + this.globalData.token;
    // 云托管模式：走 wx.callContainer（微信私有协议，免域名免备案）；否则走 wx.request
    const url = USE_CLOUD_RUN ? path : (path.startsWith('http') ? '' : this.globalData.apiBase) + path;

    // 将原始网络错误转为友好提示
    const friendlyMsg = (raw) => {
      const msg = raw || '网络错误';
      if (/connection.refused|net::ERR_|timeout|network/i.test(msg)) return '无法连接服务器，请检查网络后重试';
      if (/401|未登录|登录过期/.test(msg)) return '登录已过期，请重新登录';
      if (/403|无权限|禁止/.test(msg)) return '没有操作权限';
      if (/404|not\s*found/i.test(msg)) return '接口不存在';
      if (/402|积分不足/.test(msg)) return '积分不足，去看广告或完成任务赚积分';
      if (/429|频繁|频率/.test(msg)) return '操作过于频繁，请稍后再试';
      if (/400|参数/.test(msg)) return '请求参数有误，请检查后重试';
      return msg.length > 20 ? '请求失败，请稍后重试' : msg;
    };

    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const done = (okFlag, errMsg) => {
        // 记录接口埋点（耗时 + 成败）
        const arr = this.globalData.telemetry.apis;
        arr.push({ path: path.split('?')[0], method, ok: okFlag, ms: Date.now() - t0, err: errMsg || '', at: Date.now() });
        if (arr.length > this.globalData.telemetry.max) arr.shift();
      };
      const onResp = (res) => {
        if (res.statusCode === 401) {
          clearAuth();
          this.globalData.token = '';
          this.globalData.user = null;
          done(false, '未登录');
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          return reject(new Error('未登录'));
        }
        done(res.data && res.data.code === 0, res.data && res.data.code ? ('code ' + res.data.code) : '');
        // 透传响应头（用于列表分页 X-Has-More / X-Total-Count 等元信息）
        resolve({ ...res.data, headers: res.header || {} });
      };
      if (USE_CLOUD_RUN) {
        // 云托管必须通过 X-WX-SERVICE 指定服务名，否则网关无法把请求路由到容器
        wx.callContainer({
          config: { env: CLOUD_RUN_ENV },
          path: url,
          method: (method || 'GET').toUpperCase(),
          header: { ...headers, 'X-WX-SERVICE': CLOUD_RUN_SERVICE },
          data: data || {},
          timeout: 30000,
          success: (res) => {
            // callContainer 返回 data 常为字符串，按需解析为 JSON
            let d = res.data;
            if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) {} }
            res.data = d;
            onResp(res);
          },
          fail: (e) => { done(false, friendlyMsg(e.errMsg)); reject(new Error(friendlyMsg(e.errMsg))); },
        });
      } else {
        wx.request({ url, method, data, header: headers, success: onResp, timeout: 30000, fail: (e) => { done(false, friendlyMsg(e.errMsg)); reject(new Error(friendlyMsg(e.errMsg))); } });
      }
    });
  },

  // 页面曝光埋点
  trackPage(route) {
    const arr = this.globalData.telemetry.pages;
    arr.push({ route, at: Date.now() });
    if (arr.length > this.globalData.telemetry.max) arr.shift();
  },

  // 汇总埋点指标（调试面板使用）
  getTelemetry() {
    const a = this.globalData.telemetry.apis;
    const total = a.length;
    const fail = a.filter((x) => !x.ok).length;
    const avg = total ? Math.round(a.reduce((s, x) => s + x.ms, 0) / total) : 0;
    const p95 = total ? a.map((x) => x.ms).sort((m, n) => m - n)[Math.floor(total * 0.95)] : 0;
    return {
      total, fail,
      failRate: total ? (fail / total * 100).toFixed(1) + '%' : '0%',
      avgMs: avg, p95Ms: p95,
      apis: a.slice(-50),
      pages: this.globalData.telemetry.pages.slice(-20),
    };
  },

  // 业务错误友好提示（4xx 结构化引导）：返回提示文案，供页面 toast 使用
  friendlyBiz(r) {
    if (!r) return '请求失败，请稍后重试';
    if (r.code === 402) return '积分不足，去看广告或完成任务赚积分';
    if (r.code === 429) return '操作过于频繁，请稍后再试';
    if (r.code === 403) return '没有操作权限';
    if (r.code === 400) return r.message && r.message.length <= 20 ? r.message : '请求参数有误，请检查后重试';
    return r.message || '请求失败，请稍后重试';
  },

  logout() {
    clearAuth();
    this.globalData.token = '';
    this.globalData.user = null;
  },
});