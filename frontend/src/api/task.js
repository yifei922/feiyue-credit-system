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

// 更新任务（编辑）
export function updateTask(id, data) {
  if (mockApi.useMock) return mockApi.updateTask(id, data)
  return request.put(`/api/tasks/${id}`, data)
}

// 删除任务（级联清理完成记录与流水）
export function deleteTask(id) {
  if (mockApi.useMock) return mockApi.deleteTask(id)
  return request.delete(`/api/tasks/${id}`)
}

export function listTemplates() {
  if (mockApi.useMock) return mockApi.listTemplates()
  return request.get('/api/tasks/templates')
}
