import request from './request'
import { mockApi } from './mock'

// 上传附件（带进度回调）。支持图片/视频/Word/PDF 等任意格式。
// onProgress(percent:number)
export function uploadFile(file, taskId, onProgress) {
  if (mockApi.useMock) return mockApi.upload(file, taskId, onProgress)
  const form = new FormData()
  form.append('file', file)
  if (taskId) form.append('taskId', String(taskId))
  return request.post('/uploads', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    }
  })
}

// 删除附件
export function deleteAttachment(id) {
  if (mockApi.useMock) return Promise.resolve({ code: 0, data: { ok: true } })
  return request.delete(`/uploads/${id}`)
}

// 带鉴权获取附件字节，返回可用于 <img>/<video> 的 object URL
export async function fetchAttachmentUrl(storedName) {
  if (mockApi.useMock) return Promise.resolve('/api/uploads/' + storedName)
  const r = await request.get(`/uploads/${storedName}`, { responseType: 'blob' })
  const blob = r instanceof Blob ? r : (r.data || r)
  return URL.createObjectURL(blob)
}
