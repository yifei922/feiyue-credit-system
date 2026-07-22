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
// 流程：先打开 SSE 进度通道 → 上传文件（带 X-Upload-Job-Id）→ 服务端处理时通过 SSE 推送进度 → 收到 done 即完成。
// callbacks: { onUpload(percent), onProcess(percent|null, message, indeterminate) }
// 返回 Promise<最终附件数据>，与 /uploads 的返回值结构一致。
export function uploadFileWithProgress(file, taskId, callbacks = {}) {
  const { onUpload, onProcess } = callbacks
  if (mockApi.useMock) return mockUploadMock(file, taskId, callbacks)

  return new Promise((resolve, reject) => {
    const jobId = (crypto.randomUUID && crypto.randomUUID()) ||
      ('job-' + Date.now() + '-' + Math.random().toString(16).slice(2))
    const token = localStorage.getItem('token') || ''
    let settled = false
    let postResult = null
    const finish = (data) => { if (!settled) { settled = true; resolve(data) } }
    const failWith = (err) => { if (!settled) { settled = true; reject(err) } }

    // 1) 打开 SSE 进度通道
    const url = `/api/uploads/progress/${encodeURIComponent(jobId)}?token=${encodeURIComponent(token)}`
    let es
    try {
      es = new EventSource(url)
    } catch (e) { es = null }

    const closeEs = () => { try { es && es.close() } catch (_) {} }
    if (es) {
      es.onmessage = (ev) => {
        let msg
        try { msg = JSON.parse(ev.data) } catch (_) { return }
        if (msg.type === 'progress') {
          onProcess && onProcess(msg.percent, msg.message, msg.indeterminate)
        } else if (msg.type === 'done') {
          closeEs()
          finish({ code: 0, data: msg.data })
        } else if (msg.type === 'error') {
          closeEs()
          failWith(new Error(msg.message || '处理失败'))
        }
      }
      es.onerror = () => {
        // SSE 断开：若 POST 已成功返回则以其为准；否则继续等待 POST 结果
        if (postResult) { closeEs(); finish(postResult) }
      }
    }

    // 2) 上传文件（关闭上传超时，等待服务端处理完成）
    const form = new FormData()
    form.append('file', file)
    if (taskId) form.append('taskId', String(taskId))
    form.append('jobId', jobId)
    request.post('/uploads', form, {
      timeout: 0,
      headers: { 'X-Upload-Job-Id': jobId },
      onUploadProgress: (e) => { if (onUpload && e.total) onUpload(Math.round((e.loaded / e.total) * 100)) }
    }).then((r) => {
      const data = r.data ?? r
      postResult = data
      // 若没有 SSE（被拦截）或 SSE 尚未推送 done，以 POST 结果收尾
      if (!es) finish(data)
    }).catch((err) => {
      closeEs()
      failWith(err)
    })
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
