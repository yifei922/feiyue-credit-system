// pages/admin/users.js - 用户管理（教师/管理员）
// 对标网页端 SystemSettings → 账号管理 Tab
const app = getApp();
Page({
  data: {
    list: [],
    loading: true,
    error: '',
    roleFilter: '',
    page: 1,
    hasMore: true,
    total: 0,
    canManageUsers: false,
    ROLE_TABS: [
      { label: '全部', value: '' },
      { label: '学生', value: 'STUDENT' },
      { label: '课代表', value: 'REP' },
      { label: '教师', value: 'TEACHER' },
      { label: '管理员', value: 'ADMIN' },
    ],
    ROLE_OPTIONS: [
      { label: '学生', value: 'STUDENT' },
      { label: '课代表', value: 'REP' },
      { label: '教师', value: 'TEACHER' },
      { label: '管理员', value: 'ADMIN' },
    ],
    // 角色编辑弹窗
    showRoleModal: false,
    editTarget: null,
    editForm: { role: '', subjectIds: [] },
    allSubjects: [],
    savingRole: false,
  },

  onShow() {
    const u = app.globalData.user || {};
    this.setData({ canManageUsers: u.role === 'ADMIN' || u.role === 'TEACHER' });
    this.load(true);
    this.loadSubjects();
  },
  onPullDownRefresh() { this.load(true).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(false); },
  onRetry() { this.load(true); },

  async load(init) {
    if (this.data.loading) return;
    if (init) this.setData({ list: [], page: 1, hasMore: true, error: '' });
    if (!this.data.hasMore && !init) return;
    this.setData({ loading: true, error: '' });
    try {
      const params = { page: this.data.page, pageSize: 100 };
      if (this.data.roleFilter) params.role = this.data.roleFilter;
      const r = await app.apiGet('/api/users/', params);
      if (r.code !== 0) throw new Error(r.message || '加载失败');
      // 后端列表主体为数组，分页元信息在响应头
      const items = Array.isArray(r.data) ? r.data : (r.data.list || []);
      this.setData({
        list: init ? items : this.data.list.concat(items),
        hasMore: (r.headers && r.headers['X-Has-More'] === 'true') || false,
        page: this.data.page + 1,
        total: Number((r.headers && r.headers['X-Total-Count']) || items.length),
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false, error: e.message || '加载失败，请重试' });
      console.warn('loadUsers failed:', e.message);
    }
  },

  async loadSubjects() {
    try {
      const r = await app.apiGet('/api/subjects', { pageSize: 200 });
      this.setData({ allSubjects: Array.isArray(r.data) ? r.data : (r.data.list || []) });
    } catch (_) {}
  },

  onTab(e) {
    this.setData({ roleFilter: e.currentTarget.dataset.value });
    this.load(true);
  },

  // ---- 重置密码（原有功能）----
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

  // ---- 修改角色（新增，对标网页端 setUserRole）----
  onShowRoleEdit(e) {
    const item = e.currentTarget.dataset.item;
    // 解析已有 subjectIds（可能是数字数组或需要从 subjectNames 反推）
    const currentIds = item.subjectIds || [];
    this.setData({
      showRoleModal: true,
      editTarget: item,
      editForm: { role: item.role, subjectIds: [...currentIds] },
    });
  },

  onCloseRoleModal() { this.setData({ showRoleModal: false }); },

  onPickRole(e) {
    const role = e.currentTarget.dataset.value;
    // 切换角色时，若非 REP 则清空科目选择
    const subjectIds = role === 'REP' ? this.data.editForm.subjectIds : [];
    this.setData({ 'editForm.role': role, 'editForm.subjectIds': subjectIds });
  },

  onToggleSubject(e) {
    const id = e.currentTarget.dataset.id;
    let ids = [...this.data.editForm.subjectIds];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
    this.setData({ 'editForm.subjectIds': ids });
  },

  async onSaveRole() {
    const f = this.data.editForm;
    if (!f.role) return wx.showToast({ title: '请选择角色', icon: 'none' });
    if (f.role === 'REP' && !f.subjectIds.length) return wx.showToast({ title: '课代表需选择负责科目', icon: 'none' });

    this.setData({ savingRole: true });
    try {
      await app.apiPost('/api/users/' + this.data.editTarget.id + '/role', {
        role: f.role,
        subjectIds: f.role === 'REP' ? f.subjectIds : [],
      });
      wx.showToast({ title: '已更新', icon: 'success' });
      this.setData({ showRoleModal: false });
      this.load(); // 刷新列表
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ savingRole: false });
    }
  },
});
