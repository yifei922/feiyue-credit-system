import request from './request'
import { mockApi } from './mock'

export function login(data) {
  if (mockApi.useMock) return mockApi.login(data)
  return request.post('/api/auth/login', data)
}

export function getMe() {
  if (mockApi.useMock) return mockApi.getMe()
  return request.get('/api/auth/me')
}
