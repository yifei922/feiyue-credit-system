// pages/post-detail/post-detail.js - 动态详情 + 评论（同时复用为发布页 mode=publish）
const app = getApp();
Page({
  data: { id: null, mode: 'view', post: null, comments: [], text: '', _navTimer: null },
  onLoad(opts) {
    if (opts.mode === 'publish') { this.setData({ mode: 'publish' }); return; }
    this.setData({ id: Number(opts.id) });
    this.load();
  },
  onUnload() {
    if (this.data._navTimer) clearTimeout(this.data._navTimer);
  },
  async load() {
    try {
      // 直查单条动态 + 评论列表（避免 list+find 的 N² 扫描）
      const [post, comments] = await Promise.all([
        app.apiGet('/api/mp/posts/' + this.data.id),
        app.apiGet('/api/mp/posts/' + this.data.id + '/comments'),
      ]);
      this.setData({ post: post.data, comments: comments.data.list || [] });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  onTextInput(e) { this.setData({ text: e.detail.value }); },
  async onSubmit() {
    if (!this.data.text.trim()) return wx.showToast({ title: '请输入评论', icon: 'none' });
    try {
      await app.apiPost('/api/mp/posts/' + this.data.id + '/comments', { text: this.data.text });
      this.setData({ text: '' });
      this.load();
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  // 发布模式
  onPublishText(e) { this.setData({ pubText: e.detail.value }); },
  async onPubSubmit() {
    const text = (this.data.pubText || '').trim();
    if (!text) return wx.showToast({ title: '请输入内容', icon: 'none' });
    try {
      await app.apiPost('/api/mp/posts', { text, images: [] });
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.data._navTimer = setTimeout(() => wx.switchTab({ url: '/pages/feed/feed' }), 600);
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
});