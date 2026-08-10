// pages/resource-detail/resource-detail.js - 学习资料详情
// 访问模型：每次查阅/下载会扣积分（后端校验），无需观看广告。
const app = getApp();

Page({
  data: {
    id: null,
    res: null,
    pointsBalance: 0,
    pointsCost: 0,
    canView: true,
    contentGated: false,
    contentVisible: true,
    externalGated: true,
    loaded: false,
    viewing: false,
  },
  onLoad(opts) {
    this.setData({ id: Number(opts.id) });
    this.load();
  },
  async load() {
    if (!app.globalData.token) return;
    try {
      const r = await app.apiGet('/api/mp/resources/' + this.data.id);
      const d = r.data;
      const res = d.resource;
      this.setData({
        res,
        pointsBalance: res.pointsBalance,
        pointsCost: res.pointsCost,
        canView: res.canView,
        contentGated: !!res.contentGated,
        contentVisible: res.contentVisible !== false,
        externalGated: !!res.externalGated,
        loaded: true,
      });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  // 查看/下载：查扣积分并取 url（无广告）
  async onView() {
    const { id, res } = this.data;
    if (!res) return;
    if (this.data.viewing) return;
    this.setData({ viewing: true });
    try {
      const r = await app.apiPost('/api/mp/resources/' + id + '/access', {});
      this.setData({ 'res.url': r.data.url, 'res.type': r.data.type, pointsBalance: r.data.pointsLeft });
      this.openUrl(r.data.url, r.data.type);
    } catch (e) {
      wx.showToast({ title: e.message || '查看失败', icon: 'none' });
    } finally {
      this.setData({ viewing: false });
    }
  },
  // 打开预览/复制链接（站内处理，不引导跳出微信）
  openUrl(url, type) {
    if (!url) return wx.showToast({ title: '暂未提供资源', icon: 'none' });
    let full = url;
    if (url.startsWith('/')) full = (require('../../utils/api.js').assetBase()) + url;
    if (type === 'article' || type === 'link') {
      wx.setClipboardData({ data: full, success: () => wx.showToast({ title: '链接已复制', icon: 'none' }) });
    } else {
      wx.showModal({
        title: '资料链接', content: full, confirmText: '复制',
        success: (r) => { if (r.confirm) wx.setClipboardData({ data: full }); },
      });
    }
  },
});
