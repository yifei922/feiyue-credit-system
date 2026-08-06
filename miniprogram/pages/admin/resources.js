// pages/admin/resources.js - 资料管理（教师/管理员）
const app = getApp();
const TYPES = ['article', 'doc', 'video', 'link', 'pdf'];
const SUBJECTS = ['语文','数学','英语','物理','化学','道德与法治','历史','地理','生物'];

Page({
  data: {
    list: [],
    loading: true,
    showForm: false,
    editingId: null,
    form: { grade: '初一', subject: '数学', title: '', type: 'article', url: '', description: '', source: '' },
    subjects: SUBJECTS,
    types: TYPES,
    typeLabel: { article: '图文', doc: '文档', video: '视频', link: '链接', pdf: 'PDF' },
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await app.apiGet('/api/mp/admin/resources');
      this.setData({ list: r.data.list || [], loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  onAdd() {
    this.setData({
      showForm: true, editingId: null,
      form: { grade: '初一', subject: '数学', title: '', type: 'article', url: '', description: '', source: '' },
    });
  },

  async onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const r = await app.apiGet('/api/mp/admin/resources');
    const item = (r.data.list || []).find((x) => x.id === id);
    if (!item) return;
    this.setData({
      showForm: true, editingId: id,
      form: {
        grade: item.grade, subject: item.subject, title: item.title,
        type: item.type, url: item.url, description: item.description || '', source: item.source || '',
      },
    });
  },

  onField(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ ['form.' + key]: e.detail.value });
  },
  onSubject(e) { this.setData({ 'form.subject': this.data.subjects[e.detail.value] }); },
  onType(e) { this.setData({ 'form.type': this.data.types[e.detail.value] }); },
  onGrade(e) { this.setData({ 'form.grade': ['初一', '初二', '初三'][e.detail.value] }); },
  noop() {},

  closeForm() { this.setData({ showForm: false }); },

  async onSubmit() {
    const f = this.data.form;
    if (!f.title || !f.url) { wx.showToast({ title: '标题和链接必填', icon: 'none' }); return; }
    wx.showLoading({ title: '提交中…' });
    try {
      if (this.data.editingId) {
        await app.apiPost('/api/mp/admin/resources/' + this.data.editingId, f);
      } else {
        await app.apiPost('/api/mp/admin/resources', f);
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showForm: false });
      this.load();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除资料', content: '确定删除该资料？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await app.apiDelete('/api/mp/admin/resources/' + id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        } catch (err) { wx.showToast({ title: err.message || '删除失败', icon: 'none' }); }
      },
    });
  },
});
