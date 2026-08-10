// pages/admin/students.js - 学生管理（教师/管理员）
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');
const PAGE_SIZE = 100;

Page({
  data: {
    students: [],
    keyword: '',
    showForm: false,
    editingId: null,
    form: { name: '', student_no: '' },
    loading: false,
    error: '',
    page: 1,
    hasMore: true,
    total: 0,
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER', 'REP'])) return; this._roleChecked = true; this.loadStudents(true); },
  onPullDownRefresh() { this.loadStudents(true).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.loadStudents(false); },
  onRetry() { this.loadStudents(true); },

  async loadStudents(init) {
    if (this.data.loading) return;
    if (init) this.setData({ students: [], page: 1, hasMore: true, error: '' });
    if (!this.data.hasMore && !init) return;
    this.setData({ loading: true, error: '' });
    try {
      const r = await app.apiGet('/api/students', { page: this.data.page, pageSize: PAGE_SIZE });
      if (r.code !== 0) throw new Error(r.message || '加载失败');
      // 后端列表主体为数组，分页元信息在响应头（X-Has-More / X-Total-Count）
      const items = Array.isArray(r.data) ? r.data : (r.data.list || []);
      const kw = (this.data.keyword || '').toLowerCase();
      const filtered = kw
        ? items.filter((s) => (s.name || '').includes(kw) || (s.student_no || '').includes(kw))
        : items;
      this.setData({
        students: init ? filtered : this.data.students.concat(filtered),
        hasMore: (r.headers && r.headers['X-Has-More'] === 'true') || false,
        page: this.data.page + 1,
        total: Number((r.headers && r.headers['X-Total-Count']) || filtered.length),
      });
    } catch (e) {
      this.setData({ error: e.message || '加载失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadStudents(true));
  },

  onCreate() {
    this.setData({ showForm: true, editingId: null, form: { name: '', student_no: '' } });
  },

  onEdit(e) {
    const s = e.currentTarget.dataset.s;
    this.setData({
      showForm: true, editingId: s.id,
      form: { name: s.name || '', student_no: s.student_no || '' },
    });
  },

  onInputChange(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value });
  },

  async onSave() {
    const f = this.data.form;
    if (!f.name.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' });
    // 字段对齐后端契约：小程序用 student_no，后端解构 studentNo
    const payload = { name: f.name, studentNo: f.student_no || '' };
    this.setData({ loading: true });
    try {
      if (this.data.editingId) {
        await app.apiPut('/api/students/' + this.data.editingId, payload);
        wx.showToast({ title: '已更新', icon: 'success' });
      } else {
        await app.apiPost('/api/students', payload);
        wx.showToast({ title: '已添加', icon: 'success' });
      }
      this.setData({ showForm: false });
      this.loadStudents(true);
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCancel() { this.setData({ showForm: false }); },

  async onResetPwd(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise((r) => wx.showModal({ title: '重置密码', content: '确定将该学生密码重置为 123456？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiPost('/api/students/' + id + '/reset-password', {});
      wx.showToast({ title: '已重置为 123456', icon: 'success' });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise((r) => wx.showModal({ title: '确认删除', content: '删除后不可恢复，且关联数据可能异常。确定？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiDelete('/api/students/' + id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadStudents(true);
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
});
