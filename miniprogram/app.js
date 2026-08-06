// app.js - 全局入口与状态
const { getToken, setToken, clearAuth } = require('./utils/auth.js');
const { API_BASE } = require('./config/env.js');

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

  _api(path, method, data, noToken) {
    const url = (path.startsWith('http') ? '' : this.globalData.apiBase) + path;
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (!noToken && this.globalData.token) headers['Authorization'] = 'Bearer ' + this.globalData.token;
      wx.request({
        url, method, data, header: headers, timeout: 30000,
        success: (res) => {
          if (res.statusCode === 401) {
            // token 过期：清除登录态
            clearAuth();
            this.globalData.token = '';
            this.globalData.user = null;
            wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
            return reject(new Error('未登录'));
          }
          resolve(res.data);
        },
        fail: (e) => reject(new Error(e.errMsg || '网络错误')),
      });
    });
  },

  logout() {
    clearAuth();
    this.globalData.token = '';
    this.globalData.user = null;
  },
});