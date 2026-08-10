// pages/admin/reports.js - 举报处理（举报闭环管理 UI）
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');

Page({
  data: { list: [], loading: true },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN'])) return; this._roleChecked = true;
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/mp/admin/reports');
      this.setData({ list: r.data || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  // 标记已处理（不删动态，仅标记举报状态）
  async resolve(e) {
    const rid = e.currentTarget.dataset.rid;
    wx.showModal({
      title: '标记已处理', content: '确认该举报已处理？',
      success: async (x) => {
        if (!x.confirm) return;
        try {
          await app.apiPost('/api/mp/admin/reports/' + rid + '/resolve', {});
          wx.showToast({ title: '已标记', icon: 'success' });
          this.load();
        } catch (err) { wx.showToast({ title: err.message || '失败', icon: 'none' }); }
      },
    });
  },

  // 删除被举报的违规动态
  async deletePost(e) {
    const pid = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除动态', content: '确认删除被举报的违规动态？此操作不可恢复',
      success: async (x) => {
        if (!x.confirm) return;
        try {
          await app.apiDelete('/api/mp/posts/' + pid);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        } catch (err) { wx.showToast({ title: err.message || '失败', icon: 'none' }); }
      },
    });
  },

  viewPost(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/post-detail/post-detail?id=' + id });
  },
});