// pages/submit/submit.js - 提交作业（学生端核心）
const app = getApp();
const MAX = 30 * 1024 * 1024; // 与服务端一致

Page({
  data: {
    taskId: null,
    task: null,
    files: [],          // {path, name, size, status, progress, compressedSize, attachmentId}
    uploading: false,
    submitting: false,
    _navTimer: null,    // navigateBack 定时器引用
  },
  onLoad(opts) {
    this.setData({ taskId: Number(opts.taskId) });
    this.loadTask();
  },
  onUnload() {
    if (this.data._navTimer) clearTimeout(this.data._navTimer);
  },
  async loadTask() {
    try {
      const r = await app.apiGet('/api/tasks/' + this.data.taskId);
      this.setData({ task: r.data });
    } catch (e) {}
  },

  // 选文件（统一用 chooseMedia，兼容图片/视频/文件；旧版基础库回退 chooseMessageFile）
  chooseFile() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 5, mediaType: ['image', 'video', 'file'],
        sourceType: ['album', 'camera', 'chat'],
        success: (r) => {
          const items = r.tempFiles.map((f) => ({ path: f.tempFilePath || f.path, name: f.file?.name || '文件', size: f.size }));
          this.appendFiles(items);
        },
      });
    } else if (wx.chooseMessageFile) {
      wx.chooseMessageFile({ count: 5, success: (r) => this.appendFiles(r.tempFiles) });
    } else {
      wx.showToast({ title: '当前版本不支持选文件，请升级微信', icon: 'none' });
    }
  },

  appendFiles(items) {
    const accepted = [];
    for (const f of items) {
      if (f.size > MAX) {
        wx.showToast({ title: `${f.name || '文件'} 超过 30MB，请压缩后上传`, icon: 'none' });
        continue;
      }
      accepted.push({
        path: f.path, name: f.name || 'file', size: f.size,
        status: 'pending', progress: 0, compressedSize: null, attachmentId: null,
      });
    }
    this.setData({ files: [...this.data.files, ...accepted] });
  },

  removeFile(e) {
    const idx = e.currentTarget.dataset.i;
    this.setData({ files: this.data.files.filter((_, i) => i !== idx) });
  },

  // 逐个上传
  async uploadAll() {
    if (this.data.files.length === 0) return wx.showToast({ title: '请至少上传 1 个附件', icon: 'none' });
    this.setData({ submitting: true });
    for (let i = 0; i < this.data.files.length; i++) {
      if (this.data.files[i].attachmentId) continue;
      await this.uploadOne(i);
    }
    const all = this.data.files.every((f) => f.attachmentId);
    if (all) {
      // 提交完成登记（复用 Web 端 completion 接口）
      try {
        await app.apiPost('/api/completion', { taskId: this.data.taskId, attachmentIds: this.data.files.map((f) => f.attachmentId) });
        wx.showToast({ title: '提交成功', icon: 'success' });
        this.data._navTimer = setTimeout(() => wx.navigateBack(), 800);
      } catch (e) {
        wx.showToast({ title: e.message || '提交失败', icon: 'none' });
      }
    }
    this.setData({ submitting: false });
  },

  // 上传单个文件（小程序 wx.uploadFile）
  uploadOne(i) {
    const f = this.data.files[i];
    this.setData({ [`files[${i}].status`]: 'uploading', [`files[${i}].progress`]: 0 });
    return new Promise((resolve) => {
      const uploadTask = wx.uploadFile({
        url: (require('../../utils/api.js').assetBase()) + '/api/uploads',
        filePath: f.path,
        name: 'file',
        formData: { taskId: String(this.data.taskId) },
        header: { Authorization: 'Bearer ' + app.globalData.token },
        success: (res) => {
          try {
            const body = JSON.parse(res.data);
            if (body.code === 0) {
              this.setData({
                [`files[${i}].status`]: 'done',
                [`files[${i}].progress`]: 100,
                [`files[${i}].compressedSize`]: body.data.sizeCompressed,
                [`files[${i}].attachmentId`]: body.data.id,
              });
            } else {
              this.setData({ [`files[${i}].status`]: 'error' });
              wx.showToast({ title: body.message || '上传失败', icon: 'none' });
            }
          } catch (_) { this.setData({ [`files[${i}].status`]: 'error' }); }
          resolve();
        },
        fail: (e) => {
          this.setData({ [`files[${i}].status`]: 'error' });
          wx.showToast({ title: e.errMsg || '上传失败', icon: 'none' });
          resolve();
        },
      });
      uploadTask.onProgressUpdate((r) => {
        this.setData({ [`files[${i}].progress`]: r.progress });
      });
    });
  },

  formatSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  },
});