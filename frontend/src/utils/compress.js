// 浏览器端图片预处理：保清晰度前提下适度减小上传体积。
// 仅在图片"超大"(最长边 > maxSide) 时才缩放；否则保留原分辨率，仅高质量重编码。
// 视频/PDF/Word 等原样返回，交由服务端做视觉无损/无损压缩。
export async function compressImage(file, { maxSide = 4096, quality = 0.92 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return { blob: file, compressed: false }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const long = Math.max(bitmap.width, bitmap.height)
    const scale = long > maxSide ? maxSide / long : 1
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close && bitmap.close()

    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp'
    const outType = hasAlpha ? 'image/webp' : 'image/jpeg'
    const dataUrl = canvas.toDataURL(outType, quality)
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ext = outType === 'image/jpeg' ? 'jpg' : 'webp'
    const outName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.' + ext
    // 若重编码后反而更大（原图已是高压缩率），保留原文件以免体积/画质双输
    if (blob.size >= file.size) return { blob: file, compressed: false, width: w, height: h }
    const outFile = new File([blob], outName, { type: outType })
    return { blob: outFile, compressed: true, width: w, height: h }
  } catch (e) {
    return { blob: file, compressed: false }
  }
}

/**
 * 浏览器端视频压缩（任务 1 提速）
 * 策略：视频 > videoThreshold MB 时，用 canvas + MediaRecorder 重新编码为 webm/mp4
 *   - 默认缩放：长边 > 1280 时按比例缩到 1280
 *   - 默认码率：maxHeight 720 对应 1.5 Mbps；480 对应 0.8 Mbps（保留观感清晰度）
 *   - 进度回调：onProgress(percent 0-100) 用于显示"压缩中 N%"
 * 失败时（原样返回 + compressed:false），由服务端继续处理
 *
 * 为什么不用 ffmpeg.wasm：
 *   - 单线程版 ~25MB 首次下载；多线程版需 COOP/COEP 头部（部署复杂）
 *   - MediaRecorder 浏览器原生，零依赖，转码速度足够日常视频（1-3 分钟）
 *   - 项目约定白屏冷启动体验敏感，故选用此方案
 */
export async function compressVideo(file, { videoThreshold = 30, maxSide = 1280, bitrate = 1500000, onProgress } = {}) {
  if (!file.type.startsWith('video/')) return { blob: file, compressed: false }
  if (file.size < videoThreshold * 1024 * 1024) return { blob: file, compressed: false }
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream === 'undefined') {
    return { blob: file, compressed: false } // 老浏览器不支持
  }
  let video
  try {
    video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true // 静音避免自动播放限制
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('视频解码失败'))
      setTimeout(() => reject(new Error('视频解码超时')), 15000)
    })

    // 缩放比例
    const long = Math.max(video.videoWidth, video.videoHeight)
    const scale = long > maxSide ? maxSide / long : 1
    const w = Math.max(2, Math.round(video.videoWidth * scale))
    const h = Math.max(2, Math.round(video.videoHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    // 选 mimeType：优先 webm（VP9 压缩率高），不支持则 mp4
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''

    const stream = canvas.captureStream()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate })
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    const stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => resolve()
    })
    recorder.start(200)

    let progressTimer = null
    if (typeof onProgress === 'function') {
      progressTimer = setInterval(() => {
        try {
          const pct = video.duration ? Math.min(99, Math.round((video.currentTime / video.duration) * 100)) : 0
          onProgress(pct)
        } catch (_) {}
      }, 250)
    }

    // 边播边绘
    video.currentTime = 0
    await video.play()
    const drawLoop = () => {
      if (video.ended || video.paused) return
      try { ctx.drawImage(video, 0, 0, w, h) } catch (_) {}
      requestAnimationFrame(drawLoop)
    }
    requestAnimationFrame(drawLoop)
    await new Promise((resolve) => {
      video.onended = resolve
    })
    recorder.stop()
    await stopped
    if (progressTimer) clearInterval(progressTimer)
    URL.revokeObjectURL(url)

    const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
    if (blob.size >= file.size) return { blob: file, compressed: false } // 压完更大，保留原文件

    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const outName = (file.name || 'video').replace(/\.[^.]+$/, '') + '_compressed.' + ext
    return { blob: new File([blob], outName, { type: mimeType || 'video/webm' }), compressed: true, width: w, height: h }
  } catch (e) {
    return { blob: file, compressed: false, error: e.message }
  } finally {
    try { video && video.pause() } catch (_) {}
  }
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
