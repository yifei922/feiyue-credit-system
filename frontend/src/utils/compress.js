// 浏览器端图片预处理：保清晰度前提下适度减小上传体积。
// 仅在图片“超大”(最长边 > maxSide) 时才缩放；否则保留原分辨率，仅高质量重编码。
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

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
