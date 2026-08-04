// pages/credits/credits.js - 学分明细
const app = getApp();
Page({
  data: { list: [], loading: true },
  onShow() { this.load(); },
  async load() {
    try {
      const r = await app.apiGet('/api/credit-flow/me');
      this.setData({ list: r.data || [], loading: false });
    } catch (e) { this.setData({ loading: false }); }
  },
});