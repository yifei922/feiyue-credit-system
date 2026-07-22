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

// 上传附件并实时上报「服务端处理进度」（图片/视频/PDF 重编码可能耗时，尤其视频）。
// 关键设计：以 HTTP 响应为「完成」的唯一依据；SSE 仅用于进度展示。
// 这样即使 SSE 在代理层被缓冲/丢弃，上传也不会卡死在“处理中”。网络失败自动重试 2 次。
// callbacks: { onUpload(percent), onProcess(percent|null, message, indeterminate) }
// 返回 Promise<最终附件数据>，与 /uploads 的返回值结构一致。
export function uploadFileWithProgress(file, taskId, callbacks = {}) {
  const { onUpload, onProcess } = callbacks
  if (mockApi.useMock) return mockUploadMock(file, taskId, callbacks)

  const jobId = (crypto.randomUUID && crypto.randomUUID()) ||
    ('job-' + Date.now() + '-' + Math.random().toString(16).slice(2))
  const token = localStorage.getItem('token') || ''
  const MAX_RETRY = 2

  // 打开 SSE 进度通道（仅进度，不参与完成判定）
  const url = `/api/uploads/progress/${encodeURIComponent(jobId)}?token=${encodeURIComponent(token)}`
  let es = null
  try { es = new EventSource(url) } catch (_) { es = null }
  const closeEs = () => { try { es && es.close() } catch (_) {} }
  if (es) {
    es.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch (_) { return }
      if (msg.type === 'progress') {
        onProcess && onProcess(msg.percent, msg.message, msg.indeterminate)
      } else if (msg.type === 'error') {
        // 服务端显式返回错误（如文件过大）：关闭通道并失败
        closeEs()
        rejectOnce(new Error(msg.message || '处理失败'))
      }
      // 注意：不再以 SSE 的 done 作为完成信号，统一由 POST 响应收尾
    }
    es.onerror = () => { /* 保持连接用于进度；完成由 POST 决定 */ }
  }

  let settled = false
  let rejectFn = null
  const rejectOnce = (err) => { if (!settled && rejectFn) { settled = true; closeEs(); rejectFn(err) } }

  return new Promise((resolve, reject) => {
    rejectFn = reject
    const doPost = (attempt) => {
      const form = new FormData()
      form.append('file', file)
      if (taskId) form.append('taskId', String(taskId))
      form.append('jobId', jobId)
      request.post('/uploads', form, {
        timeout: 0,
        headers: { 'X-Upload-Job-Id': jobId },
        onUploadProgress: (e) => { if (onUpload && e.total) onUpload(Math.round((e.loaded / e.total) * 100)) }
      }).then((r) => {
        closeEs()
        if (!settled) { settled = true; resolve(r.data ?? r) }
      }).catch((err) => {
        const retriable = !err.response && attempt < MAX_RETRY // 仅网络层失败重试
        if (retriable) {
          if (onProcess) onProcess(null, `网络中断，正在重试(${attempt + 1}/${MAX_RETRY})…`, true)
          setTimeout(() => doPost(attempt + 1), 800)
        } else {
          closeEs()
          if (!settled) { settled = true; reject(err) }
        }
      })
    }
    doPost(0)
  })
}

// 模拟模式：分阶段模拟「上传 → 处理（图片/文档转圈、视频带百分比）」
function mockUploadMock(file, taskId, callbacks) {
  const { onUpload, onProcess } = callbacks
  return new Promise((resolve) => {
    const isVid = (file.type || '').startsWith('video/')
    let up = 0
    const t1 = setInterval(() => {
      up += 20 + Math.random() * 25
      if (up >= 100) { up = 100; onUpload && onUpload(100); clearInterval(t1); phase2() }
      else onUpload && onUpload(Math.round(up))
    }, 120)
    function phase2() {
      if (isVid) {
        let p = 0
        const t2 = setInterval(() => {
          p += 8 + Math.random() * 14
          if (p >= 100) { p = 100; onProcess && onProcess(100, '视频转码完成'); clearInterval(t2); done() }
          else onProcess && onProcess(Math.round(p), '视频转码中…')
        }, 200)
      } else {
        onProcess && onProcess(null, '压缩处理中…', true)
        setTimeout(done, 700)
      }
    }
    function done() {
      const size = file.size
      const compressed = Math.max(1, Math.round(size * 0.6))
      resolve({ code: 0, data: {
        id: Date.now(), url: '', originalName: file.name, mime: file.type,
        sizeOriginal: size, sizeCompressed: compressed, width: null, height: null,
        method: isVid ? 'video' : 'image', compressed: true, ratio: 40
      }})
    }
  })
}

// 附件存储用量统计（管理端）
export function fetchStorageUsage() {
  if (mockApi.useMock) {
    return Promise.resolve({ code: 0, data: {
      files: 6, usedBytes: 3_500_000, originalBytes: 9_800_000, savedBytes: 6_300_000,
      quotaBytes: 1024 * 1024 * 1024, ephemeral: true,
      note: '免费层为临时磁盘，重新部署或实例重建后附件会被清空；如需长期保存请接入对象存储（R2/OSS）。'
    }})
  }
  return request.get('/uploads/stats/usage')
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

// ── 未完成上传的本地留存（用于意外关闭后提示续传）──
// 浏览器安全限制：关闭页面后无法恢复 File 对象本身，故这里只留存「任务标识」，
// 重新进入时提示用户，并由用户重新选择同一文件后继续上传。
const PENDING_KEY = 'feiyue_pending_uploads'
export function getPendingUploads() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch (_) { return [] }
}
export function addPendingUpload(item) {
  const list = getPendingUploads().filter((i) => i.id !== item.id)
  list.push(item)
  localStorage.setItem(PENDING_KEY, JSON.stringify(list))
}
export function removePendingUpload(id) {
  const list = getPendingUploads().filter((i) => i.id !== id)
  localStorage.setItem(PENDING_KEY, JSON.stringify(list))
}
export function clearPendingUploads() {
  localStorage.removeItem(PENDING_KEY)
}
