// pages/resource-detail/resource-detail.js - 课程资料详情
// 访问模型：当天首次需看「悬浮窗激励视频广告」解锁；每次查阅/下载会扣积分（后端校验）。
const app = getApp();
const { showRewardedVideo, adCfg } = require('../../utils/ad.js');

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
  // 查看/下载：先看广告（若需）→ 再查扣积分取 url
  async onView() {
    const { id, res } = this.data;
    if (!res) return;
    if (this.data.viewing) return;
    this.setData({ viewing: true });
    try {
      // 1) 当天未看广告 → 弹悬浮窗激励视频，看完记录
      if (res.requiresAd) {
        const watched = await showRewardedVideo(adCfg.REWARD_AD_UNIT_ID, async () => {
          try { await app.apiPost('/api/mp/resources/' + id + '/ad-done', {}); } catch (_) {}
        });
        if (!watched) { this.setData({ viewing: false }); return; }
        await this.load(); // 刷新：requiresAd 应为 false
      }
      // 2) 查扣积分并取资源 url
      const r = await app.apiPost('/api/mp/resources/' + id + '/access', {});
      this.setData({ 'res.url': r.data.url, 'res.type': r.data.type, pointsBalance: r.data.pointsLeft });
      this.openUrl(r.data.url, r.data.type);
    } catch (e) {
      wx.showToast({ title: e.message || '查看失败', icon: 'none' });
    } finally {
      this.setData({ viewing: false });
    }
  },
  // 打开预览/外链
  openUrl(url, type) {
    if (!url) return wx.showToast({ title: '暂未提供资源', icon: 'none' });
    // 相对路径（/study/xxx.html）自动拼接后端域名，本地与线上通用
    let full = url;
    if (url.startsWith('/')) full = (require('../../utils/api.js').assetBase()) + url;
    if (type === 'article' || type === 'link') {
      wx.setClipboardData({ data: full, success: () => wx.showToast({ title: '链接已复制，去浏览器打开', icon: 'none' }) });
    } else {
      wx.showModal({
        title: '资料链接', content: full, confirmText: '复制',
        success: (r) => { if (r.confirm) wx.setClipboardData({ data: full }); },
      });
    }
  },
});
