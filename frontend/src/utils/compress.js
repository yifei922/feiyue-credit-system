// 浏览器端图片压缩：在上传前先压缩，进一步减少体积与上传耗时。
// 仅对图片生效；视频/PDF/Word 等原样返回（服务端也会再做一次压缩兜底）。
export async function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
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
    const outFile = new File([blob], outName, { type: outType })
    return { blob: outFile, compressed: blob.size < file.size, width: w, height: h }
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
