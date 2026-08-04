import request from './request'

// 账号列表（管理员/老师）；可按 role 过滤
export function listUsers(role) {
  return request.get('/api/users', { params: role ? { role } : {} })
}

// 重置/设定密码（不传 password 则重置为 123456）
export function resetPassword(userId, password) {
  return request.post(`/api/users/${userId}/reset-password`, password ? { password } : {})
}

// 设置角色 + 课代表科目绑定
export function setUserRole(userId, role, subjectIds) {
  return request.post(`/api/users/${userId}/role`, { role, subjectIds })
}
