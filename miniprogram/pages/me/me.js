// pages/me/me.js - Tab5 我的（按角色展示不同功能）
const app = getApp();
Page({
  data: {
    user: null,
    points: 0,
    totalEarned: 0,
    credits: [],
    canManage: false,
    canManageUsers: false,  // 用于 me.wxml 中"成员/兴趣分类管理"菜单的可见性（仅 ADMIN）
    canManageTasks: false,  // 用于 me.wxml 中"任务管理"菜单的可见性（ADMIN/TEACHER/REP）
  },
  onShow() {
    app.trackPage('pages/me/me');
    if (!app.globalData.token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const u = app.globalData.user || {};
    this.setData({
      user: u,
      canManage: u.role === 'ADMIN' || u.role === 'TEACHER' || u.role === 'REP',
      canManageUsers: u.role === 'ADMIN',          // 仅管理员能管用户/兴趣分类
      canManageTasks: u.role === 'ADMIN' || u.role === 'TEACHER' || u.role === 'REP',
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
      const r = await app.apiGet('/api/credit-flow');
      this.setData({ credits: (r.data || []).slice(0, 20) });
    } catch (_) {}
  },
  goCredits() { wx.navigateTo({ url: '/pages/credits/credits' }); },
  goPublish() { wx.navigateTo({ url: '/pages/post-detail/post-detail?mode=publish' }); },
  goProfile() { wx.navigateTo({ url: '/pages/profile/profile' }); },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/index' }); },
  goTasks() { wx.navigateTo({ url: '/pages/admin/tasks' }); },
  goStudents() { wx.navigateTo({ url: '/pages/admin/students' }); },
  goSubjects() { wx.navigateTo({ url: '/pages/admin/subjects' }); },
  goCreditsAdjust() { wx.navigateTo({ url: '/pages/admin/credits-adjust' }); },
  goSubmit() { wx.navigateTo({ url: '/pages/submit/submit' }); },
  goStudy() { wx.switchTab({ url: '/pages/study/study' }); },
  onLogout() {
    wx.showModal({
      title: '确认退出？', content: '退出后将清除本地登录态。',
      success: (r) => {
        if (r.confirm) { app.logout(); wx.reLaunch({ url: '/pages/login/login' }); }
      },
    });
  },
});
