// pages/feed/feed.js - Tab4 成长圈（社交动态信息流）
const app = getApp();
Page({
  data: { list: [], loading: true, page: 1, hasMore: true },
  onShow() { app.trackPage('pages/feed/feed'); this.load(true); },
  // 图片加载失败兜底（隐藏该 image，避免破图占位）
  onImgErr(e) {
    const { src, currentTarget } = e.detail || {};
    // 仅在控制台提示，不动列表（小程序端修改 image src 较繁琐）
    if (src) console.warn('[feed] 图片加载失败:', src);
  },
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
    // 立即乐观更新 UI（避免整列表 reload 闪烁）
    const list = this.data.list.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          liked: !it.liked,
          like_count: (it.like_count || 0) + (it.liked ? -1 : 1),
        };
      }
      return it;
    });
    this.setData({ list });
    try { await app.apiPost('/api/mp/posts/' + id + '/like', {}); }
    catch (e) {
      // 失败回滚
      const rollback = this.data.list.map((it) => {
        if (it.id === id) {
          return { ...it, liked: !it.liked, like_count: (it.like_count || 0) + (it.liked ? -1 : 1) };
        }
        return it;
      });
      this.setData({ list: rollback });
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  // 预览动态图片（wx.previewImage 全屏查看，双指缩放）
  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ urls, current });
  },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()); },
  // 举报动态（内容安全闭环）
  async reportPost(e) {
    const id = e.currentTarget.dataset.id;
    const r = await new Promise((resolve) => wx.showModal({
      title: '举报动态', content: '确认举报该动态含违规内容？', success: (x) => resolve(x),
    }));
    if (!r.confirm) return;
    try {
      await app.apiPost('/api/mp/posts/' + id + '/report', { reason: '用户举报' });
      wx.showToast({ title: '举报已提交', icon: 'success' });
    } catch (err) { wx.showToast({ title: err.message || '举报失败', icon: 'none' }); }
  },
});