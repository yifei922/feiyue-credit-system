// pages/tasks/tasks.js - Tab3 作业（任务列表）
const app = getApp();
Page({
  data: {
    tab: 'open',
    open: [],
    done: [],
    overdue: [],
    loading: true,
  },
  onShow() { this.load(); },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
  },
  async load() {
    if (!app.globalData.token) return;
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/tasks');
      const all = r.data || [];
      const now = Date.now();
      const open = [], done = [], overdue = [];
      for (const t of all) {
        const deadline = t.deadline ? new Date(t.deadline.replace(/-/g, '/')).getTime() : null;
        if (t.status === 'DONE') done.push(t);
        else if (deadline && deadline < now) overdue.push(t);
        else open.push(t);
      }
      this.setData({ open, done, overdue, loading: false });
    } catch (e) { this.setData({ loading: false }); }
  },
  goSubmit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/submit/submit?taskId=' + id });
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
});