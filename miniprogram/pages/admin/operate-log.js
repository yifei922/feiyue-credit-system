// pages/admin/operate-log.js - 操作日志
// 对标网页端 SystemSettings.vue 的「操作日志」Tab (/settings?tab=log)
const app = getApp();
Page({
  data: {
    records: [],
    loading: true,
    error: '',
    operatorName: '',
    operateType: '',
    startTime: '',
    endTime: '',
    page: 1,
    hasMore: true,
    total: 0,
    TYPE_OPTIONS: ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'RESET_PASSWORD', 'ADJUST', 'ROLE'],
    TYPE_LABELS: {
      '': '全部类型',
      CREATE: '新增',
      UPDATE: '修改',
      DELETE: '删除',
      LOGIN: '登录',
      RESET_PASSWORD: '重置密码',
      ADJUST: '积分调整',
      ROLE: '角色变更',
    },
    logTypeIndex: 0,
    showSnap: false,
    snap: null,
  },

  onShow() { this.load(true); },
  onPullDownRefresh() { this.load(true).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(false); },
  onRetry() { this.load(true); },

  async load(init) {
    if (this.data.loading) return;
    if (init) this.setData({ records: [], page: 1, hasMore: true, error: '' });
    if (!this.data.hasMore && !init) return;
    this.setData({ loading: true, error: '' });
    try {
      const params = { page: this.data.page, pageSize: 50 };
      if (this.data.operatorName) params.operatorName = this.data.operatorName;
      if (this.data.operateType) params.operateType = this.data.operateType;
      if (this.data.startTime) params.startTime = this.data.startTime;
      if (this.data.endTime) params.endTime = this.data.endTime;
      const r = await app.apiGet('/api/operate-logs', params);
      if (r.code !== 0) throw new Error(r.message || '加载失败');
      this.setData({
        records: init ? (r.data.records || []) : this.data.records.concat(r.data.records || []),
        hasMore: r.data.hasMore,
        page: this.data.page + 1,
        total: r.data.total,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false, error: e.message || '加载失败，请重试' });
      console.warn('loadOperateLogs failed:', e.message);
    }
  },

  onSearchInput(e) { this.setData({ operatorName: e.detail.value }); },
  onSearch() { this.load(true); },
  onStartChange(e) { this.setData({ startTime: e.detail.value }); },
  onEndChange(e) { this.setData({ endTime: e.detail.value }); },
  onTypeChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ logTypeIndex: idx, operateType: this.data.TYPE_OPTIONS[idx] });
    this.load(true);
  },

  // 查看快照（对标快照弹窗）
  onViewSnap(e) {
    const item = e.currentTarget.dataset.item;
    let before = item.beforeSnapshot || '';
    let after = item.afterSnapshot || '';
    try { before = JSON.stringify(JSON.parse(before), null, 2); } catch (_) {}
    try { after = JSON.stringify(JSON.parse(after), null, 2); } catch (_) {}
    this.setData({
      showSnap: true,
      snap: {
        operatorName: item.operatorName,
        operateType: this.data.TYPE_LABELS[item.operateType] || item.operateType,
        tableName: item.tableName,
        recordId: item.recordId,
        createTime: item.createTime,
        before, after,
      },
    });
  },
  onCloseSnap() { this.setData({ showSnap: false, snap: null }); },

  fmtType(t) { return this.data.TYPE_LABELS[t] || t; },
});
