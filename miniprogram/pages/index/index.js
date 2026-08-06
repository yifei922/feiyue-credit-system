// pages/index/index.js - Tab1 首页
const app = getApp();
const { showInterstitial, adCfg } = require('../../utils/ad.js');

Page({
  data: {
    user: null,
    grade: '初一',
    subjects: ['语文','数学','英语','物理','化学','道德与法治','历史','地理','生物'],
    resources: [],
    loading: true,
  },

  onShow() {
    if (!app.globalData.token) {
      wx.switchTab({ url: '/pages/me/me' });
      return;
    }
    this.setData({ user: app.globalData.user });
    this.loadResources();
    this.maybeShowSplash();
  },

  // 开屏广告：每天首次进入展示一次插屏广告（未配置广告位则跳过）
  maybeShowSplash() {
    if (!adCfg.hasSplash) return;
    const key = 'splash_shown_' + new Date().toISOString().slice(0, 10);
    if (wx.getStorageSync(key)) return;
    wx.setStorageSync(key, 1);
    showInterstitial(adCfg.SPLASH_AD_UNIT_ID);
  },


  // 切换年级
  onGradeChange(e) {
    this.setData({ grade: e.currentTarget.dataset.g });
    this.loadResources();
  },

  // 课程资料
  async loadResources() {
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/mp/resources', { grade: this.data.grade, page: 1 });
      this.setData({ resources: r.data.list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 跳详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + id });
  },

  // 快捷入口
  onTabTasks() { wx.switchTab({ url: '/pages/tasks/tasks' }); },
  onTabStudy() { wx.switchTab({ url: '/pages/study/study' }); },
  onTabFeed() { wx.switchTab({ url: '/pages/feed/feed' }); },
  onTabMe() { wx.switchTab({ url: '/pages/me/me' }); },

  onPullDownRefresh() {
    this.loadResources().finally(() => wx.stopPullDownRefresh());
  },
});