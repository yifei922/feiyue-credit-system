import request from './request'
import { mockApi } from './mock'

export function listAlerts() {
  if (mockApi.useMock) return mockApi.listAlerts()
  return request.get('/api/alerts')
}

export function resolveAlert(id) {
  if (mockApi.useMock) return mockApi.resolveAlert(id)
  return request.put(`/api/alerts/${id}/resolve`)
}

export function scanAlerts() {
  if (mockApi.useMock) return mockApi.scanAlerts()
  return request.post('/api/alerts/scan')
}
