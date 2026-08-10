// 隐私授权封装
// 微信要求：收集昵称、头像、相册、摄像头等个人信息前，必须弹出隐私授权弹窗。
// 开启 app.json 的 __usePrivacyCheck__ 后，本函数触发系统隐私弹窗（内容来自公众平台配置的《用户隐私保护指引》）。
function ensurePrivacyAuthorize() {
  return new Promise((resolve) => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      // 基础库过低不支持隐私弹窗：不阻断业务，直接放行（旧版无强制要求）
      return resolve(true);
    }
    wx.requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => resolve(false), // 用户拒绝也仅记录，不阻断核心功能
    });
  });
}

// 打开隐私政策详情页（用户点「查看」时跳转，需在公众平台配置隐私指引 URL）
function openPrivacyDetail() {
  if (typeof wx.openPrivacyContract === 'function') {
    wx.openPrivacyContract({ fail: () => wx.showToast({ title: '隐私协议加载失败', icon: 'none' }) });
  } else {
    wx.showToast({ title: '请前往「我的 → 关于」查看隐私说明', icon: 'none' });
  }
}

module.exports = { ensurePrivacyAuthorize, openPrivacyDetail };
