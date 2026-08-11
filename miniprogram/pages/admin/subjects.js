// pages/admin/subjects.js - 兴趣分类管理 + 小组长任命
// 对标网页端 SystemSettings → 小组长任命 Tab
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');
Page({
  data: {
    subjects: [],
    showForm: false,
    editingId: null,
    form: { name: '' },
    loading: false,
    error: '',
    // 小组长弹窗
    showRepModal: false,
    repTarget: null,
    repCandidates: [],
    selectedRepId: null,
    savingRep: false,
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER'])) return; this._roleChecked = true; this.loadSubjects(); this.loadRepCandidates(); },
  onPullDownRefresh() { this.loadSubjects().then(() => wx.stopPullDownRefresh()); },
  onRetry() { this.loadSubjects(); },

  async loadSubjects() {
    this.setData({ loading: true, error: '' });
    try {
      const r = await app.apiGet('/api/subjects', { pageSize: 200 });
      if (r.code !== 0) throw new Error(r.message || '加载失败');
      // 后端 /api/subjects 返回数组（分页元信息在响应头）
      this.setData({ subjects: Array.isArray(r.data) ? r.data : (r.data.list || []) });
    } catch (e) {
      this.setData({ error: e.message || '加载失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadRepCandidates() {
    try {
      const r = await app.apiGet('/api/users/', { role: 'REP', pageSize: 200 });
      const arr = Array.isArray(r.data) ? r.data : (r.data && r.data.list) || [];
      this.setData({ repCandidates: arr.filter((u) => u.role === 'REP') });
    } catch (_) {}
  },

  onCreate() { this.setData({ showForm: true, editingId: null, form: { name: '' } }); },

  onEdit(e) {
    const s = e.currentTarget.dataset.s;
    this.setData({ showForm: true, editingId: s.id, form: { name: s.name || '' } });
  },

  onInputChange(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },

  async onSave() {
    if (!this.data.form.name.trim()) return wx.showToast({ title: '请输入兴趣分类名称', icon: 'none' });
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
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后关联的任务和积分记录可能异常。确定？', success: r }));
    if (!res.confirm) return;
    try {
      await app.apiDelete('/api/subjects/' + id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadSubjects();
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },

  // ---- 小组长任命（新增）----
  onShowRepModal(e) {
    const s = e.currentTarget.dataset.s;
    // 找到当前已选的小组长（从 rep_names 反推不太可靠，直接让用户重选）
    this.setData({
      showRepModal: true,
      repTarget: s,
      selectedRepId: null,
    });
  },

  onCloseRepModal() { this.setData({ showRepModal: false }); },

  onPickRep(e) { this.setData({ selectedRepId: e.currentTarget.dataset.id }); },

  async onSaveRep() {
    if (!this.data.selectedRepId) return wx.showToast({ title: '请选择小组长', icon: 'none' });
    this.setData({ savingRep: true });
    try {
      // 后端接口：POST /api/subjects/:id/reps  { userIds:[...] }（subject_rep 关联表，可多可单）
      await app.apiPost('/api/subjects/' + this.data.repTarget.id + '/reps', {
        userIds: [this.data.selectedRepId],
      });
      wx.showToast({ title: '已设置小组长', icon: 'success' });
      this.setData({ showRepModal: false });
      this.loadSubjects(); // 刷新以显示新小组长
    } catch (e) {
      console.warn('setReps failed:', e.message);
      wx.showToast({ title: e.message || '设置失败', icon: 'none' });
    } finally {
      this.setData({ savingRep: false });
    }
  },

  // 列表里直接显示当前小组长姓名
  repNamesOf(s) {
    return (s.repNames && s.repNames.length) ? s.repNames.join('、') : '未设置';
  },
});
