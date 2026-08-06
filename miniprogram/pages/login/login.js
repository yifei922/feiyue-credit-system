// pages/login/login.js
const app = getApp();

Page({
  data: {
    showPwd: false,
    username: '',
    password: '',
    loading: false,
    coldHint: '',
  },

  onLoad() {
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  // 一键微信登录
  async onWxLogin() {
    this.setData({ loading: true, coldHint: '正在唤醒服务器…' });
    try {
      const r = await app.wxLogin();
      if (r.bound) {
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.showModal({
          title: '欢迎！',
          content: '首次登录，请在「我的」页面完善个人资料。',
          showCancel: false,
          success: () => wx.switchTab({ url: '/pages/index/index' }),
        });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '微信登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, coldHint: '' });
    }
  },

  // 账号密码登录
  async onPwdLogin() {
    const { username, password } = this.data;
    if (!username || !password) return wx.showToast({ title: '请填写用户名和密码', icon: 'none' });
    this.setData({ loading: true, coldHint: '正在唤醒服务器…' });
    try {
      await app.pwdLogin(username, password);
      wx.switchTab({ url: '/pages/index/index' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, coldHint: '' });
    }
  },

  togglePwd() { this.setData({ showPwd: !this.data.showPwd }); },
  onUserInput(e) { this.setData({ username: e.detail.value }); },
  onPwdInput(e) { this.setData({ password: e.detail.value }); },
});