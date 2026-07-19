import request from './request'
import { mockApi } from './mock'

export function listTasks(params) {
  if (mockApi.useMock) return mockApi.listTasks()
  return request.get('/api/tasks', { params })
}

export function createTask(data) {
  if (mockApi.useMock) return mockApi.createTask(data)
  return request.post('/api/tasks', data)
}

export function saveAsTemplate(data) {
  if (mockApi.useMock) return mockApi.saveAsTemplate(data)
  return request.post('/api/tasks/template', data)
}

export function createFromTemplate(templateId) {
  if (mockApi.useMock) return mockApi.createFromTemplate(templateId)
  return request.post(`/api/tasks/from-template/${templateId}`)
}

export function listTemplates() {
  if (mockApi.useMock) return mockApi.listTemplates()
  return request.get('/api/tasks/templates')
}
