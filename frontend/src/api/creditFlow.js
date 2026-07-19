import request from './request'
import { mockApi } from './mock'

export function listCreditFlow(params) {
  if (mockApi.useMock) return mockApi.listCreditFlow(params)
  return request.get('/api/credit-flow', { params })
}
