// pages/admin/users.js - 用户管理（教师/管理员）
const app = getApp();
Page({
  data: {
    list: [],
    loading: true,
    roleFilter: '',
    ROLE_TABS: [
      { label: '全部', value: '' },
      { label: '学生', value: 'STUDENT' },
      { label: '课代表', value: 'REP' },
      { label: '教师', value: 'TEACHER' },
      { label: '管理员', value: 'ADMIN' },
    ],
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/users/', this.data.roleFilter ? { role: this.data.roleFilter } : undefined);
      this.setData({ list: r.data || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  onTab(e) {
    this.setData({ roleFilter: e.currentTarget.dataset.value });
    this.load();
  },

  async onReset(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '重置密码', content: '将把「' + name + '」的密码重置为 123456，确定？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await app.apiPost('/api/users/' + id + '/reset-password', {});
          wx.showToast({ title: '已重置为 123456', icon: 'success' });
        } catch (err) { wx.showToast({ title: err.message || '失败', icon: 'none' }); }
      },
    });
  },
});
