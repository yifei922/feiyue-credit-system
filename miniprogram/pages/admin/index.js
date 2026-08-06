// pages/admin/index.js - 管理后台入口（教师/管理员/课代表）
// 方案选择：直接在小程序内嵌管理功能（而非 webview 跳转网页），
// 理由：个人主体小程序 webview 需配置业务域名且要托管站点，门槛高；
// 管理动作少（资料/用户/概览），内嵌小程序最省事。详见 docs/ADMIN_DESIGN.md
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
});
