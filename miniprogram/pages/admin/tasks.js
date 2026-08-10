// pages/admin/tasks.js - 任务/作业管理（教师/管理员/课代表）
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');

Page({
  data: {
    tasks: [],
    filter: 'all', // all | OPEN | CLOSED
    subjects: [],
    showForm: false,
    editingId: null,
    form: { title: '', description: '', subjectId: '', points: 1, deadline: '', status: 'OPEN' },
    showCompletions: false,
    completions: [],
    currentTask: null,
    loading: false,
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER', 'REP'])) return; this._roleChecked = true;
    this.loadSubjects();
    this.loadTasks();
  },

  onPullDownRefresh() {
    this.loadTasks().then(() => wx.stopPullDownRefresh());
  },

  async loadTasks() {
    try {
      const r = await app.apiGet('/api/tasks');
      let list = (r.data || []);
      if (this.data.filter !== 'all') list = list.filter(t => t.status === this.data.filter);
      this.setData({ tasks: list });
    } catch (e) { console.error('loadTasks', e); }
  },

  async loadSubjects() {
    try {
      const r = await app.apiGet('/api/subjects');
      this.setData({ subjects: r.data || [] });
    } catch (_) {}
  },

  onFilter(e) {
    const f = e.currentTarget.dataset.f;
    this.setData({ filter: f }, () => this.loadTasks());
  },

  // 新建任务
  onCreate() {
    this.setData({
      showForm: true, editingId: null,
      form: { title: '', description: '', subjectId: '', points: 1, deadline: '', status: 'OPEN' },
    });
  },

  // 编辑任务
  onEdit(e) {
    const t = e.currentTarget.dataset.task;
    this.setData({
      showForm: true, editingId: t.id,
      form: {
        title: t.title || '',
        description: t.description || '',
        subjectId: String(t.subject_id || ''),
        points: t.points || 1,
        deadline: t.deadline || '',
        status: t.status || 'OPEN',
      },
    });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onSubjectPick(e) {
    this.setData({ 'form.subjectId': e.currentTarget.dataset.id });
  },

  onDeadlineChange(e) {
    this.setData({ 'form.deadline': e.detail.value });
  },

  async onSave() {
    const f = this.data.form;
    if (!f.title.trim()) return wx.showToast({ title: '请输入任务标题', icon: 'none' });
    // 字段对齐后端契约：小程序用 points，后端解构 creditValue（积分奖励）
    const payload = { ...f, creditValue: Number(f.points) || 0 };
    this.setData({ loading: true });
    try {
      if (this.data.editingId) {
        await app.apiPut('/api/tasks/' + this.data.editingId, payload);
        wx.showToast({ title: '已更新', icon: 'success' });
      } else {
        await app.apiPost('/api/tasks', payload);
        wx.showToast({ title: '已创建', icon: 'success' });
      }
      this.setData({ showForm: false });
      this.loadTasks();
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCancel() {
    this.setData({ showForm: false });
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(resolve => {
      wx.showModal({ title: '确认删除', content: '删除后不可恢复，确定？', success: resolve });
    });
    if (!res.confirm) return;
    try {
      await app.apiDelete('/api/tasks/' + id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadTasks();
    } catch (e) { wx.showToast({ title: e.message || '删除失败', icon: 'none' }); }
  },

  // 查看完成情况
  // 完成情况弹层：内存 LRU 缓存（30 秒内同任务不重读）
  async onViewCompletions(e) {
    const t = e.currentTarget.dataset.task;
    const cache = this._completionsCache || (this._completionsCache = new Map());
    const now = Date.now();
    const hit = cache.get(t.id);
    this.setData({ showCompletions: true, currentTask: t });
    if (hit && now - hit.t < 30000) {
      this.setData({ completions: hit.data });
      return;
    }
    this.setData({ completions: [] });
    try {
      const r = await app.apiGet('/api/completions', { task_id: t.id });
      const data = r.data || [];
      cache.set(t.id, { t: now, data });
      this.setData({ completions: data });
    } catch (_) {}
  },

  onCloseCompletions() {
    this.setData({ showCompletions: false });
  },

  // 快速登记完成
  async onQuickComplete(e) {
    const sid = e.currentTarget.dataset.sid;
    try {
      // 对齐后端契约：POST /api/completion/register，字段 taskId/studentIds
      await app.apiPost('/api/completion/register', {
        taskId: this.data.currentTask.id,
        studentIds: [sid],
        status: 'FINISHED',
      });
      wx.showToast({ title: '已登记', icon: 'success' });
      // 失效缓存，强制重读
      if (this._completionsCache) this._completionsCache.delete(this.data.currentTask.id);
      this.onViewCompletions({ currentTarget: { dataset: { task: this.data.currentTask } } });
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
  },
});
