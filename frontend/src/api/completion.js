import request from './request'
import { downloadBlobApi } from '@/utils/download'

// 登记完成记录
export function registerCompletion(data) {
  return request.post('/api/completion/register', data)
}

// 成绩明细列表
export function listCompletions(params) {
  return request.get('/api/completion', { params })
}

// 成绩导入：CSV 文本或 { records: [...] }
export function importCompletions(payload) {
  return request.post('/api/completion/import', payload)
}

// 成绩明细导出：走 fetch 直下
export function exportCompletions(format = 'csv', extra = {}) {
  const qs = new URLSearchParams({ format, ...extra }).toString()
  return downloadBlobApi(`/api/completion/export?${qs}`, `completions_${Date.now()}.csv`)
}

