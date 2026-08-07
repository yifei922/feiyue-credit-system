// pages/debug/telemetry.js - 轻量埋点调试面板（#6 可观测）
const app = getApp();

Page({
  data: { stats: {}, apis: [], pages: [] },

  onShow() { this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },

  refresh() {
    const t = app.getTelemetry();
    this.setData({
      stats: { total: t.total, fail: t.fail, failRate: t.failRate, avgMs: t.avgMs, p95Ms: t.p95Ms },
      apis: t.apis.slice().reverse(),
      pages: t.pages.slice().reverse(),
    });
  },

  onClear() {
    app.globalData.telemetry.apis = [];
    app.globalData.telemetry.pages = [];
    this.refresh();
  },

  copyJson() {
    wx.setClipboardData({
      data: JSON.stringify(app.getTelemetry()),
      success: () => wx.showToast({ title: '已复制', icon: 'none' }),
    });
  },
});
