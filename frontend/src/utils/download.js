// 浏览器端文件下载：把 Blob 触发为文件下载
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 解析 CSV/文本为二维数组（支持逗号或制表符分隔）
export function parseCsvText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,\t]/).map((x) => x.trim()))
}
