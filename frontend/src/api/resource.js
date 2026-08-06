// 课程资料管理 API 客户端（Web 端后台）
import request from './request'

const PREFIX = '/api/mp/admin/resources'

export function listResources(params) {
  return request({ url: PREFIX, method: 'GET', params })
}
export function createResource(data) {
  return request({ url: PREFIX, method: 'POST', data })
}
export function updateResource(id, data) {
  return request({ url: `${PREFIX}/${id}`, method: 'PUT', data })
}
export function deleteResource(id) {
  return request({ url: `${PREFIX}/${id}`, method: 'DELETE' })
}
export function batchImportResources(list) {
  return request({ url: `${PREFIX}/batch`, method: 'POST', data: { list } })
}