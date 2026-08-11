// pages/admin/resources.js - 资料管理（管理员/主理人）
// 合规说明：个人主体禁止 K12 学科类校外培训，subject 改为通用兴趣标签，grade 改为难度等级。
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');
const TYPES = ['article', 'doc', 'video', 'link', 'pdf'];
const SUBJECTS = ['阅读', '写作', '思维', '编程', '艺术', '手工', '科普', '语言', '历史人文', '运动健康'];
const GRADES = ['入门', '进阶', '挑战'];

Page({
  data: {
    list: [],
    loading: true,
    showForm: false,
    editingId: null,
    form: { grade: '入门', subject: '阅读', title: '', type: 'article', url: '', description: '', source: '' },
    subjects: SUBJECTS,
    grades: GRADES,
    types: TYPES,
    typeLabel: { article: '图文', doc: '文档', video: '视频', link: '链接', pdf: 'PDF' },
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER'])) return; this._roleChecked = true; this.load(); },

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
      form: { grade: '入门', subject: '阅读', title: '', type: 'article', url: '', description: '', source: '' },
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
  onGrade(e) { this.setData({ 'form.grade': GRADES[e.detail.value] }); },
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
