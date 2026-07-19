import request from './request'
import { mockApi } from './mock'

export function listOperateLogs(params) {
  if (mockApi.useMock) return mockApi.listOperateLogs(params)
  return request.get('/api/operate-logs', { params })
}
