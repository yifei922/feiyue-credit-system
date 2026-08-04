// pages/feed/feed.js - Tab4 班级圈（社交动态信息流）
const app = getApp();
Page({
  data: { list: [], loading: true, page: 1, hasMore: true },
  onShow() { this.load(true); },
  async load(reset = false) {
    if (!app.globalData.token) return;
    if (reset) { this.setData({ page: 1, list: [], hasMore: true }); }
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/mp/feed', { page: this.data.page });
      const newList = r.data.list || [];
      this.setData({
        list: this.data.list.concat(newList),
        page: this.data.page + 1,
        hasMore: r.data.hasMore,
        loading: false,
      });
    } catch (e) { this.setData({ loading: false }); }
  },
  // 发布按钮（用 switchTab 不能 navigateTo，所以用 wx.navigateTo 跳到新页）
  goPublish() { wx.navigateTo({ url: '/pages/post-detail/post-detail?mode=publish' }); },
  goDetail(e) { wx.navigateTo({ url: '/pages/post-detail/post-detail?id=' + e.currentTarget.dataset.id }); },
  async toggleLike(e) {
    const id = e.currentTarget.dataset.id;
    try { await app.apiPost('/api/mp/posts/' + id + '/like', {}); this.load(true); }
    catch (e) { wx.showToast({ title: e.message || '操作失败', icon: 'none' }); }
  },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()); },
});