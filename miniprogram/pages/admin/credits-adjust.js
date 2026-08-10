// pages/admin/credits-adjust.js - 手动积分调整（教师/管理员/课代表）
const app = getApp();

const { requireRole } = require('../../utils/auth-guard.js');

Page({
  data: {
    students: [],
    subjects: [],
    form: {
      studentId: '',
      subjectId: '',
      amount: '1',
      reason: '',
      type: 'add', // add | sub
      studentName: '',
    },
    loading: false,
    recentAdjusts: [],
  },

  onShow() {
    if (!this._roleChecked && !requireRole(['ADMIN', 'TEACHER', 'REP'])) return; this._roleChecked = true; this.loadBase(); },

  async loadBase() {
    try {
      const [sR, subR] = await Promise.all([
        app.apiGet('/api/students'),
        app.apiGet('/api/subjects'),
      ]);
      this.setData({ students: sR.data || [], subjects: subR.data || [] });
    } catch (_) {}
  },

  onTypePick(e) { this.setData({ 'form.type': e.currentTarget.dataset.t }); },

  onStudentPick(e) {
    const s = e.currentTarget.dataset.s;
    this.setData({ 'form.studentId': s.id, 'form.studentName': s.name });
  },

  onSubjectPick(e) { this.setData({ 'form.subjectId': e.currentTarget.dataset.id }); },

  onInputChange(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },

  async onSubmit() {
    const f = this.data.form;
    if (!f.studentId) return wx.showToast({ title: '请选择学生', icon: 'none' });
    if (!f.amount || isNaN(Number(f.amount)) || Number(f.amount) <= 0) return wx.showToast({ title: '请输入有效分数', icon: 'none' });
    if (!f.reason.trim()) return wx.showToast({ title: '请填写原因', icon: 'none' });

    this.setData({ loading: true });
    try {
      const val = f.type === 'add' ? Number(f.amount) : -Number(f.amount);
      // 对齐后端契约：studentId / amount / reason（subject_id、type 后端不需要）
      await app.apiPost('/api/credit-flow/adjust', {
        studentId: f.studentId,
        amount: val,
        reason: f.reason.trim(),
      });
      wx.showToast({ title: f.type === 'add' ? '已加分' : '已扣分', icon: 'success' });
      // 重置表单
      this.setData({
        form: { studentId: '', subjectId: '', amount: '1', reason: '', type: 'add', studentName: '' },
      });
    } catch (e) { wx.showToast({ title: e.message || '操作失败', icon: 'none' }); }
    finally { this.setData({ loading: false }); }
  },
});
