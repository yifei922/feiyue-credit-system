// pages/admin/index.js - 管理后台工作台（教师/管理员/课代表）
const app = getApp();
Page({
  data: {
    role: '',
    roleLabel: '',
    canManageUsers: false,
    stats: { resources: 0, users: 0, todayViews: 0 },
  },

  onShow() {
    const u = app.globalData.user || {};
    const role = u.role;
    this.setData({
      role,
      roleLabel: role === 'ADMIN' ? '管理员' : role === 'TEACHER' ? '教师' : role === 'REP' ? '课代表' : '',
      canManageUsers: role === 'ADMIN' || role === 'TEACHER',
    });
    this.loadStats();
  },

  async loadStats() {
    try {
      const r = await app.apiGet('/api/mp/admin/stats');
      if (r && r.data) this.setData({ stats: r.data });
    } catch (_) {}
  },

  goResources() { wx.navigateTo({ url: '/pages/admin/resources' }); },
  goUsers() { wx.navigateTo({ url: '/pages/admin/users' }); },
  goCredits() { wx.navigateTo({ url: '/pages/credits/credits' }); },
  goTasks() { wx.navigateTo({ url: '/pages/admin/tasks' }); },
  goStudents() { wx.navigateTo({ url: '/pages/admin/students' }); },
  goSubjects() { wx.navigateTo({ url: '/pages/admin/subjects' }); },
  goCreditsAdjust() { wx.navigateTo({ url: '/pages/admin/credits-adjust' }); },
});
