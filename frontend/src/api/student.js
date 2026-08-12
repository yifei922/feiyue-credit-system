import request from './request'
import { downloadBlobApi } from '@/utils/download'

// 名单列表
export function listStudents(params = {}) {
  return request.get('/api/students', { params })
}

// 名单导入：CSV 文本或 { students: [{name, studentNo}] }
export function importStudents(payload) {
  return request.post('/api/students/import', payload)
}

// 名单导出：走 fetch 直下，避免 axios blob 拦截器把错误 JSON 当 CSV 写入
export function exportStudents(format = 'csv') {
  return downloadBlobApi(`/api/students/export?format=${encodeURIComponent(format)}`, `students_${Date.now()}.csv`)
}

// 重置单个成员登录密码
export function resetStudentPassword(studentId, password) {
  return request.post(`/api/students/${studentId}/reset-password`, password ? { password } : {})
}

// 批量重置多名成员密码（先用单条接口循环）
export async function batchResetStudentPassword(studentIds, password) {
  const results = []
  for (const id of studentIds) {
    try {
      const r = await resetStudentPassword(id, password)
      results.push({ id, ok: true, ...(r.data || r) })
    } catch (e) {
      results.push({ id, ok: false, error: e.message || '失败' })
    }
  }
  return results
}

// 恢复已软删除成员（回收站页用）
export function restoreStudent(studentId) {
  return request.post(`/api/students/${studentId}/restore`)
}

// 列出已软删除成员（回收站页用）
export function listDeletedStudents() {
  return request.get('/api/students?deleted=1')
}

