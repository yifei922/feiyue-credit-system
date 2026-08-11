// pages/profile/profile.js - 个人资料编辑（头像/姓名/编号）
const app = getApp();
Page({
  data: {
    avatar: '',
    name: '',
    studentId: '',
    original: {},     // 进入时的原始值，用于判断是否有改动
    saving: false,
    uploading: false,
  },

  onLoad() {
    const u = app.globalData.user || {};
    const init = {
      avatar: u.avatar || '',
      name: u.name || '',
      studentId: u.studentId != null ? String(u.studentId) : '',
    };
    this.setData({ ...init, original: { ...init } });
  },

  // 选图片 → 上传 → 回填头像
  async onChooseAvatar() {
    if (this.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const temp = res.tempFiles[0].tempFilePath;
        this.setData({ uploading: true });
        wx.showLoading({ title: '上传中…' });
        try {
          const url = await this.uploadAvatar(temp);
          if (url) {
            this.setData({ avatar: url });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          }
        } catch (e) {
          wx.showToast({ title: e.message || '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
          this.setData({ uploading: false });
        }
      },
    });
  },

  uploadAvatar(tempPath) {
    return new Promise((resolve, reject) => {
      const apiBase = app.globalData.apiBase;
      wx.uploadFile({
        url: (require('../../utils/api.js').assetBase()) + '/api/uploads/',
        filePath: tempPath,
        name: 'file',
        header: { Authorization: 'Bearer ' + app.globalData.token },
        success: (res) => {
          try {
            const body = JSON.parse(res.data);
            if (body && body.url) resolve(body.url);
            else reject(new Error((body && body.message) || '上传返回异常'));
          } catch (_) {
            reject(new Error('上传解析失败'));
          }
        },
        fail: (e) => reject(new Error(e.errMsg || '网络错误')),
      });
    });
  },

  onName(e) { this.setData({ name: e.detail.value }); },
  onStudentId(e) { this.setData({ studentId: e.detail.value }); },

  // 保存：仅提交有改动的字段
  async onSave() {
    if (this.data.saving) return;
    const { avatar, name, studentId, original } = this.data;
    const body = {};
    if (name !== original.name) body.name = name;
    const sid = studentId === '' ? null : Number(studentId);
    if (String(sid) !== String(original.studentId === '' ? null : Number(original.studentId))) {
      body.studentId = sid;
    }
    if (avatar !== original.avatar) body.avatar = avatar;
    if (Object.keys(body).length === 0) {
      wx.showToast({ title: '没有改动', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中…' });
    try {
      const r = await app.apiPost('/api/mp/profile', body);
      // 同步到全局 + 本地存储
      const u = Object.assign({}, app.globalData.user, {
        name: r.data.name,
        studentId: r.data.studentId,
        avatar: r.data.avatar,
      });
      app.globalData.user = u;
      wx.setStorageSync('user', u);
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
