// utils/auth.js - token 与本地存储工具
function getToken() { return wx.getStorageSync('token') || ''; }
function setToken(t) { wx.setStorageSync('token', t); }
function clearAuth() {
  try { wx.removeStorageSync('token'); wx.removeStorageSync('user'); } catch (_) {}
}
module.exports = { getToken, setToken, clearAuth };