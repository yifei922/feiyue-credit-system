// app.js - 全局入口与状态
const { getToken, setToken, clearAuth } = require('./utils/auth.js');
const { API_BASE, USE_CLOUD_RUN, CLOUD_RUN_ENV } = require('./config/env.js');

App({
  globalData: {
    apiBase: API_BASE, // 后端地址（见 config/env.js）
    user: null,
    token: '',
    systemInfo: null,
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
    return new Promise((resolve, reject) => {
      const onResp = (res) => {
        if (res.statusCode === 401) {
          clearAuth();
          this.globalData.token = '';
          this.globalData.user = null;
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          return reject(new Error('未登录'));
        }
        resolve(res.data);
      };
      if (USE_CLOUD_RUN) {
        wx.callContainer({
          config: { env: CLOUD_RUN_ENV },
          path: url,
          method: (method || 'GET').toUpperCase(),
          header: headers,
          data: data || {},
          timeout: 30000,
          success: (res) => {
            // callContainer 返回 data 常为字符串，按需解析为 JSON
            let d = res.data;
            if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) {} }
            res.data = d;
            onResp(res);
          },
          fail: (e) => reject(new Error(e.errMsg || '网络错误')),
        });
      } else {
        wx.request({ url, method, data, header: headers, timeout: 30000, success: onResp, fail: (e) => reject(new Error(e.errMsg || '网络错误')) });
      }
    });
  },

  logout() {
    clearAuth();
    this.globalData.token = '';
    this.globalData.user = null;
  },
});