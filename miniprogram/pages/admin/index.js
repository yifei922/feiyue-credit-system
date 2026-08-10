// pages/admin/index.js - 管理后台工作台（对标网页端 MainLayout + Dashboard）
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');
Page({
  data: {
    role: '',
    roleLabel: '',
    canManageUsers: false,
    canManage: false,
    stats: { students: 0, tasks: 0, avgCredits: 0, todayActive: 0 },
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER', 'REP'])) return; this._roleChecked = true;
    const u = app.globalData.user || {};
    const role = u.role;
    this.setData({
      role,
      roleLabel: role === 'ADMIN' ? '管理员' : role === 'TEACHER' ? '教师' : role === 'REP' ? '课代表' : '',
      canManageUsers: role === 'ADMIN' || role === 'TEACHER',
      canManage: role === 'ADMIN' || role === 'TEACHER' || role === 'REP',
    });
    this.loadStats();
  },

  async loadStats() {
    try {
      // 对标网页端 Dashboard 统计：在读学生数、任务数、平均积分
      const [statsR, tasksR] = await Promise.all([
        app.apiGet('/api/mp/admin/stats').catch(() => ({})),
        app.apiGet('/api/tasks').catch(() => ({ data: [] })),
      ]);
      const stats = statsR?.data || {};
      const tasks = tasksR?.data || [];
      // 尝试从 students 接口拿学生数作为 fallback
      let studentCount = stats.students || stats.users || 0;
      if (!studentCount) {
        const sR = await app.apiGet('/api/students').catch(() => ({ data: [] }));
        studentCount = (sR?.data || []).length;
      }
      this.setData({
        stats: {
          students: studentCount,
          tasks: tasks.length,
          avgCredits: stats.avgCredits || stats.totalPoints || 0,
          todayActive: stats.todayViews || stats.todayActive || 0,
        },
      });
    } catch (_) {}
  },

  goTasks() { wx.navigateTo({ url: '/pages/admin/tasks' }); },
  goStudents() { wx.navigateTo({ url: '/pages/admin/students' }); },
  goSubjects() { wx.navigateTo({ url: '/pages/admin/subjects' }); },
  goResources() { wx.navigateTo({ url: '/pages/admin/resources' }); },
  goUsers() { wx.navigateTo({ url: '/pages/admin/users' }); },
  goCreditsAdjust() { wx.navigateTo({ url: '/pages/admin/credits-adjust' }); },
  goCredits() { wx.navigateTo({ url: '/pages/credits/credits' }); },
  goAlerts() { wx.navigateTo({ url: '/pages/admin/alerts' }); },
  goOperateLog() { wx.navigateTo({ url: '/pages/admin/operate-log' }); },
});
