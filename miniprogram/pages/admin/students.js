// pages/admin/students.js - 学生管理（教师/管理员）
const app = getApp();

Page({
  data: {
    students: [],
    keyword: '',
    showForm: false,
    editingId: null,
    form: { name: '', student_no: '' },
    loading: false,
    total: 0,
  },

  onShow() { this.loadStudents(); },
  onPullDownRefresh() { this.loadStudents().then(() => wx.stopPullDownRefresh()); },

  async loadStudents() {
    try {
      const r = await app.apiGet('/api/students');
      let list = (r.data || []);
      if (this.data.keyword) {
        const kw = this.data.keyword.toLowerCase();
        list = list.filter(s => (s.name || '').includes(kw) || (s.student_no || '').includes(kw));
      }
      this.setData({ students: list, total: list.length });
    } catch (e) { console.error('loadStudents', e); }
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.loadStudents());
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
    this.setData({ loading: true });
    try {
      if (this.data.editingId) {
        await app.apiPut('/api/students/' + this.data.editingId, f);
        wx.showToast({ title: '已更新', icon: 'success' });
      } else {
        await app.apiPost('/api/students', f);
        wx.showToast({ title: '已添加', icon: 'success' });
      }
      this.setData({ showForm: false });
      this.loadStudents();
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCancel() { this.setData({ showForm: false }); },

  async onResetPwd(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '重置密码', content: '确定将该学生密码重置为 123456？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiPost('/api/students/' + id + '/reset-password', {});
      wx.showToast({ title: '已重置为 123456', icon: 'success' });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复，且关联数据可能异常。确定？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiDelete('/api/students/' + id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadStudents();
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
});
