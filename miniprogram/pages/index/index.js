// pages/index/index.js - Tab1 首页
const app = getApp();

Page({
  data: {
    user: null,
    points: 0,
    resources: [],
    loading: true,
  },

  onShow() {
    app.trackPage('pages/index/index');
    if (!app.globalData.token) {
      wx.switchTab({ url: '/pages/me/me' });
      return;
    }
    this.setData({ user: app.globalData.user });
    this.loadPoints();
    this.loadResources();
  },

  // 加载用户积分
  async loadPoints() {
    try {
      const r = await app.apiGet('/api/mp/me/points');
      this.setData({ points: (r.data && (r.data.points ?? r.data.totalEarned)) || 0 });
    } catch (e) { /* 静默失败，避免首页空白 */ }
  },

  onAvatarError() { /* 头像加载失败兜底（CSS 已设默认色） */ },
  onLogoError() { /* logo 加载失败兜底 */ },

  // 学习资料（中性定位，不区分难度学科）
  async loadResources() {
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/mp/resources', { page: 1 });
      this.setData({ resources: r.data.list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 跳详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + id });
  },

  // 快捷入口
  onTabTasks() { wx.switchTab({ url: '/pages/tasks/tasks' }); },
  onTabStudy() { wx.switchTab({ url: '/pages/study/study' }); },
  onTabFeed() { wx.switchTab({ url: '/pages/feed/feed' }); },
  onTabMe() { wx.switchTab({ url: '/pages/me/me' }); },

  onPullDownRefresh() {
    this.loadResources().finally(() => wx.stopPullDownRefresh());
  },
});