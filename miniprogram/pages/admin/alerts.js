// pages/admin/alerts.js - 预警中心
// 对标网页端 WarningCenter.vue (/alerts)
const app = getApp();
Page({
  data: {
    alerts: [],
    loading: true,
    statusFilter: '', // '' | PENDING | RESOLVED
    STATUS_TABS: [
      { label: '全部', value: '' },
      { label: '待处理', value: 'PENDING' },
      { label: '已解决', value: 'RESOLVED' },
    ],
    scanning: false,
  },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ loading: true });
    try {
      const params = {};
      if (this.data.statusFilter) params.status = this.data.statusFilter;
      const r = await app.apiGet('/api/alerts', params);
      this.setData({ alerts: r.data || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      console.warn('loadAlerts failed:', e.message);
    }
  },

  onTab(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.value });
    this.load();
  },

  // 标记解决（对标 resolveAlert）
  async onResolve(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({
      title: '标记解决', content: '确定将此预警标记为已解决？', success: r,
    }));
    if (!res.confirm) return;
    try {
      await app.apiPost('/api/alerts/' + id + '/resolve', {});
      wx.showToast({ title: '已标记解决', icon: 'success' });
      this.load();
    } catch (e) { wx.showToast({ title: e.message || '操作失败', icon: 'none' }); }
  },

  // 手动触发预警扫描（对标 scanAlerts）
  async onScan() {
    this.setData({ scanning: true });
    try {
      const r = await app.apiPost('/api/alerts/scan', {});
      const count = (r.data && r.data.created) ? r.data.created : 0;
      wx.showToast({ title: `扫描完成，新增 ${count} 条预警`, icon: 'success' });
      this.load();
    } catch (e) { wx.showToast({ title: e.message || '扫描失败', icon: 'none' }); }
    finally { this.setData({ scanning: false }); }
  },
});
