// pages/me/change-pwd.js - 首次登录强制改密 / 常规改密
const app = getApp();

Page({
  data: {
    newPwd: '',
    confirmPwd: '',
    loading: false,
    error: '',
    forced: false, // 是否强制改密（首次登录）
  },

  onLoad(query) {
    this.setData({ forced: query && query.forced === '1' });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value, error: '' });
  },

  async onSubmit() {
    const { newPwd, confirmPwd } = this.data;
    if (!newPwd || newPwd.length < 4) return this.setData({ error: '新密码至少 4 位' });
    if (newPwd.length > 64) return this.setData({ error: '密码过长' });
    if (newPwd !== confirmPwd) return this.setData({ error: '两次输入不一致' });
    this.setData({ loading: true, error: '' });
    try {
      const r = await app.apiPost('/api/auth/change-password', { newPassword: newPwd });
      if (r.code !== 0) throw new Error(r.message || '修改失败');
      // 更新本地 user 的强制改密标记
      const u = app.globalData.user || {};
      u.mustChangePwd = false;
      wx.setStorageSync('user', u);
      app.globalData.user = u;
      wx.showToast({ title: '密码已修改', icon: 'success' });
      setTimeout(() => {
        if (this.data.forced) wx.reLaunch({ url: '/pages/index/index' });
        else wx.navigateBack();
      }, 800);
    } catch (e) {
      this.setData({ error: e.message || '修改失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
