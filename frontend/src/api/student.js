import request from './request'
import { mockApi } from './mock'

export function listStudents() {
  if (mockApi.useMock) return mockApi.listStudents()
  return request.get('/api/students')
}

// 名单导入：CSV 文本或 { students: [{name, studentNo}] }
export function importStudents(payload) {
  if (mockApi.useMock) return Promise.resolve({ code: 0, data: { imported: 0, total: 0 } })
  return request.post('/api/students/import', payload)
}

// 名单导出：返回 Blob（CSV/JSON），由调用方下载
export function exportStudents(format = 'csv') {
  return request.get('/api/students/export', { params: { format }, responseType: 'blob' })
}

// 重置学生登录密码（不传 password 则重置为 123456）
export function resetStudentPassword(studentId, password) {
  return request.post(`/api/students/${studentId}/reset-password`, password ? { password } : {})
}
