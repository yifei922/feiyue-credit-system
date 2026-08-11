// pages/study/study.js - Tab2 资料（兴趣资料库）
const app = getApp();
Page({
  data: {
    keyword: '',
    list: [],
    loading: true,
  },
  onShow() { app.trackPage('pages/study/study'); this.load(); },
  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearchConfirm() { this.load(); },
  async load() {
    if (!app.globalData.token) return;
    this.setData({ loading: true });
    try {
      const params = { page: 1 };
      if (this.data.keyword) params.keyword = this.data.keyword;
      const r = await app.apiGet('/api/mp/resources', params);
      this.setData({ list: r.data.list || [], loading: false });
    } catch (e) { this.setData({ loading: false }); }
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + e.currentTarget.dataset.id });
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
});