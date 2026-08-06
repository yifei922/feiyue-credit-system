// pages/me/me.js - Tab5 我的
const app = getApp();
Page({
  data: {
    user: null,
    points: 0,
    totalEarned: 0,
    credits: [],   // 学分明细（暂拉空数组，等学分接口）
    canManage: false,  // 教师/管理员/课代表可见「管理后台」
  },
  onShow() {
    if (!app.globalData.token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const u = app.globalData.user || {};
    const role = u.role;
    this.setData({
      user: u,
      canManage: role === 'ADMIN' || role === 'TEACHER' || role === 'REP',
    });
    this.loadPoints();
    this.loadCredits();
  },
  async loadPoints() {
    try {
      const r = await app.apiGet('/api/mp/me/points');
      this.setData({ points: r.data.points, totalEarned: r.data.totalEarned });
    } catch (_) {}
  },
  async loadCredits() {
    try {
      const r = await app.apiGet('/api/credit-flow/me');
      this.setData({ credits: (r.data || []).slice(0, 20) });
    } catch (_) {}
  },
  goCredits() { wx.navigateTo({ url: '/pages/credits/credits' }); },
  goPublish() { wx.navigateTo({ url: '/pages/post-detail/post-detail?mode=publish' }); },
  goProfile() { wx.navigateTo({ url: '/pages/profile/profile' }); },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/index' }); },
  onLogout() {
    wx.showModal({
      title: '确认退出？', content: '退出后将清除本地登录态。',
      success: (r) => {
        if (r.confirm) { app.logout(); wx.reLaunch({ url: '/pages/login/login' }); }
      },
    });
  },
});
