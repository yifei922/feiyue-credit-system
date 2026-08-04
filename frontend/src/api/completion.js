import request from './request'
import { mockApi } from './mock'

export function registerCompletion(data) {
  if (mockApi.useMock) return mockApi.registerCompletion(data)
  return request.post('/api/completion/register', data)
}

// 成绩明细列表
export function listCompletions(params) {
  if (mockApi.useMock && mockApi.listCompletions) return mockApi.listCompletions(params)
  return request.get('/api/completion', { params })
}

// 成绩导入：CSV 文本或 { records: [{studentNo/studentName, taskId/taskTitle, status}] }
export function importCompletions(payload) {
  if (mockApi.useMock) return Promise.resolve({ code: 0, data: { imported: 0, skipped: 0, errors: [] } })
  return request.post('/api/completion/import', payload)
}

// 成绩明细导出：返回 Blob（CSV/JSON）。extra 可带 { studentId } 让教师/课代表导出指定学生
export function exportCompletions(format = 'csv', extra = {}) {
  return request.get('/api/completion/export', { params: { format, ...extra }, responseType: 'blob' })
}
