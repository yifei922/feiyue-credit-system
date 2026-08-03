// pages/resource-detail/resource-detail.js - 课程资料详情 + 广告解锁
const app = getApp();
Page({
  data: { id: null, res: null, freeQuota: null, requiresAd: false, adUnlocksToday: 0, adDailyLimit: 20, loaded: false },
  onLoad(opts) { this.setData({ id: Number(opts.id) }); this.load(); },
  async load() {
    if (!app.globalData.token) return;
    try {
      const r = await app.apiGet('/api/mp/resources/' + this.data.id);
      const d = r.data;
      this.setData({
        res: d.resource, freeQuota: d.freeQuota, requiresAd: d.requiresAd,
        adUnlocksToday: d.adUnlocksToday, adDailyLimit: d.adUnlockDailyLimit, loaded: true,
      });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
  // 看广告解锁（实际项目里接入 wx.createRewardedVideoAd）
  onWatchAd() {
    if (!wx.createRewardedVideoAd) {
      wx.showModal({ title: '广告组件未开通', content: '请在微信公众平台开通激励视频广告位后再试。', showCancel: false });
      return;
    }
    const ad = wx.createRewardedVideoAd({ adUnitId: 'adunit-please-replace' });
    ad.onLoad(() => {});
    ad.onError((e) => wx.showToast({ title: '广告加载失败', icon: 'none' }));
    ad.onClose((res) => {
      if (res && res.isEnded) {
        // 完整观看，调用后端解锁接口
        app.apiPost('/api/mp/resources/' + this.data.id + '/unlock', {}).then((r) => {
          this.setData({ 'res.url': r.data.url, requiresAd: false });
          wx.showToast({ title: '已解锁，请查看', icon: 'success' });
        }).catch((e) => wx.showToast({ title: e.message, icon: 'none' }));
      } else {
        wx.showToast({ title: '需看完视频才能解锁', icon: 'none' });
      }
    });
    ad.load().then(() => ad.show()).catch(() => wx.showToast({ title: '广告展示失败', icon: 'none' }));
  },
  // 已免费或已解锁：直接打开预览/外链
  onOpen() {
    if (!this.data.res || !this.data.res.url) return wx.showToast({ title: '暂未提供资源', icon: 'none' });
    const url = this.data.res.url;
    if (this.data.res.type === 'article' || this.data.res.type === 'link') {
      wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '链接已复制到剪贴板', icon: 'none' }) });
    } else {
      wx.showModal({ title: '资源链接', content: url, confirmText: '复制', success: (r) => { if (r.confirm) wx.setClipboardData({ data: url }); } });
    }
  },
});