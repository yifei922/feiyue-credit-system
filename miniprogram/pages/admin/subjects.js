// pages/admin/subjects.js - 科目管理（教师/管理员）
const app = getApp();

Page({
  data: {
    subjects: [],
    showForm: false,
    editingId: null,
    form: { name: '' },
    loading: false,
  },

  onShow() { this.loadSubjects(); },
  onPullDownRefresh() { this.loadSubjects().then(() => wx.stopPullDownRefresh()); },

  async loadSubjects() {
    try {
      const r = await app.apiGet('/api/subjects');
      this.setData({ subjects: r.data || [] });
    } catch (e) { console.error('loadSubjects', e); }
  },

  onCreate() { this.setData({ showForm: true, editingId: null, form: { name: '' } }); },

  onEdit(e) {
    const s = e.currentTarget.dataset.s;
    this.setData({ showForm: true, editingId: s.id, form: { name: s.name || '' } });
  },

  onInputChange(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },

  async onSave() {
    if (!this.data.form.name.trim()) return wx.showToast({ title: '请输入科目名称', icon: 'none' });
    this.setData({ loading: true });
    try {
      if (this.data.editingId) {
        await app.apiPut('/api/subjects/' + this.data.editingId, this.data.form);
        wx.showToast({ title: '已更新', icon: 'success' });
      } else {
        await app.apiPost('/api/subjects', this.data.form);
        wx.showToast({ title: '已创建', icon: 'success' });
      }
      this.setData({ showForm: false });
      this.loadSubjects();
    } catch (e) { wx.showToast({ title: e.message || '操作失败', icon: 'none' }); }
    finally { this.setData({ loading: false }); }
  },

  onCancel() { this.setData({ showForm: false }); },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后关联的任务和学分记录可能异常。确定？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiDelete('/api/subjects/' + id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadSubjects();
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
});
