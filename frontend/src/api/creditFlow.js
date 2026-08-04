import request from './request'
import { mockApi } from './mock'

export function listCreditFlow(params) {
  if (mockApi.useMock) return mockApi.listCreditFlow(params)
  return request.get('/api/credit-flow', { params })
}

// 手动增减学分
export function adjustCredit(studentId, amount, reason) {
  return request.post('/api/credit-flow/adjust', { studentId, amount, reason })
}
