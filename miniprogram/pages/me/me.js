// pages/me/me.js - Tab5 我的
const app = getApp();
Page({
  data: {
    user: null,
    points: 0,
    totalEarned: 0,
    credits: [],   // 学分明细（暂拉空数组，等学分接口）
  },
  onShow() {
    if (!app.globalData.token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ user: app.globalData.user });
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
    // 学分明细暂时复用 /api/credit-flow（学生角色可看自己的）
    try {
      const r = await app.apiGet('/api/credit-flow/me');
      this.setData({ credits: (r.data || []).slice(0, 20) });
    } catch (_) {}
  },
  goCredits() { wx.navigateTo({ url: '/pages/credits/credits' }); },
  goPublish() { wx.navigateTo({ url: '/pages/post-detail/post-detail?mode=publish' }); },
  onLogout() {
    wx.showModal({
      title: '确认退出？', content: '退出后将清除本地登录态。',
      success: (r) => {
        if (r.confirm) { app.logout(); wx.reLaunch({ url: '/pages/login/login' }); }
      },
    });
  },
});