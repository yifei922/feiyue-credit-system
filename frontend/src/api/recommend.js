import request from './request'
import { mockApi } from './mock'

export function recommendTasks(params) {
  if (mockApi.useMock) return mockApi.recommend(params)
  return request.get('/api/recommend', { params })
}
