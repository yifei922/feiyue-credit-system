import request from './request'

// 列出全部徽章（定义）
export function listAllBadges() {
  return request.get('/api/badge/all')
}

// 列出当前用户已获得的徽章
export function listMyBadges() {
  return request.get('/api/badge/my')
}

// 授予徽章（管理员/主理人）
export function grantBadge(userId, code) {
  return request.post('/api/badge/grant', { userId, code })
}

