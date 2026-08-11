// 角色路由守卫：所有 admin/* 页面 onLoad 第一行调用 requireRole(allowed)
// 成员角色命中任何受限页面 → 弹 toast + reLaunch 到个人中心
const app = getApp();

function requireRole(allowedRoles) {
  const u = (app && app.globalData && app.globalData.user) || null;
  const role = u && u.role;
  if (!role) {
    // 未登录或登录态失效 → 跳登录
    wx.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => wx.reLaunch({ url: '/pages/login/login' }), 600);
    return false;
  }
  if (allowedRoles.indexOf(role) === -1) {
    wx.showToast({ title: '无权访问该页面', icon: 'none' });
    setTimeout(() => wx.reLaunch({ url: '/pages/me/me' }), 700);
    return false;
  }
  return true;
}

module.exports = { requireRole };
