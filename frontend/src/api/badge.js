import request from './request'

// 列出全部徽章（用于徽章墙展示）
export function listAllBadges() {
  return request.get('/api/badge/list')
}

// 列出当前用户已获得的徽章
export function listMyBadges() {
  return request.get('/api/badge/my')
}

// 当前用户徽章进度 + 连续打卡 streak + 热力图
export function getBadgeProgress() {
  return request.get('/api/badge/progress')
}

// 授予徽章（管理员/教师）
export function grantBadge(userId, code) {
  return request.post('/api/badge/grant', { userId, code })
}

// 批量颁发（管理员/教师）
export function grantBadgeBatch(grants) {
  return request.post('/api/badge/grant-batch', { grants })
}

// 撤销徽章（管理员）
export function revokeBadge(userId, code) {
  return request.post('/api/badge/revoke', { userId, code })
}

// 班级徽章矩阵概览（教师/管理员）
export function getClassOverview() {
  return request.get('/api/badge/class-overview')
}

// 授予记录（教师/管理员）
export function getGrantLogs() {
  return request.get('/api/badge/grant-logs')
}

// 徽章库 CRUD（管理员）
export function createBadge(payload) {
  return request.post('/api/badge', payload)
}
export function updateBadge(id, payload) {
  return request.put(`/api/badge/${id}`, payload)
}
export function deleteBadge(id) {
  return request.delete(`/api/badge/${id}`)
}
