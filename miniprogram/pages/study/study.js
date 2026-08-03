// pages/study/study.js - Tab2 学习（课程资料）
const app = getApp();
Page({
  data: {
    grade: '初一',
    subject: '',
    subjects: ['语文','数学','英语','物理','化学','道德与法治','历史','地理','生物'],
    grades: ['初一','初二','初三'],
    list: [],
    loading: true,
  },
  onShow() { this.load(); },
  onGradeChange(e) { this.setData({ grade: e.currentTarget.dataset.g }); this.load(); },
  onSubjectChange(e) { this.setData({ subject: e.currentTarget.dataset.s }); this.load(); },
  onSearchInput(e) { this.setData({ keyword: e.detail.value }); },
  onSearchConfirm() { this.load(); },
  async load() {
    if (!app.globalData.token) return;
    this.setData({ loading: true });
    try {
      const params = { grade: this.data.grade, page: 1 };
      if (this.data.subject) params.subject = this.data.subject;
      const r = await app.apiGet('/api/mp/resources', params);
      this.setData({ list: r.data.list || [], loading: false });
    } catch (e) { this.setData({ loading: false }); }
  },
  goDetail(e) {
    wx.navigateTo({ url: '/pages/resource-detail/resource-detail?id=' + e.currentTarget.dataset.id });
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
});