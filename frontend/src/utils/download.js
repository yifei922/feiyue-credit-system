// 浏览器端文件下载：把 Blob 触发为文件下载
// 单 Blob 触发下载（兼容已有调用方）
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

// ─────────────────────────────────────────────────────────────
// ★ 新增：基于 fetch 的 API 文件下载
// 解决痛点：axios 拦截器把后端 401/403/500 的 JSON 响应按 blob 解析后，
//          旧 downloadBlob(blob, ...) 会把这个 JSON 当作 CSV 写入磁盘，
//          浏览器/Excel 打开失败弹"请重新打开"提示。
//
// 本函数：
//   1. 走原生 fetch，不进 axios 拦截器
//   2. 非 2xx 响应读取为文本，识别是否 JSON 错误体，按错误码弹 ElMessage
//   3. 成功响应按服务端 Content-Disposition 的 filename 触发下载；
//      回退到调用方传入的 defaultName
//   4. 自动加 JWT
// ─────────────────────────────────────────────────────────────
export async function downloadBlobApi(apiPath, defaultName) {
  const baseURL = import.meta.env.VITE_API_BASE ?? ''
  const url = baseURL + apiPath
  const token = localStorage.getItem('token') || ''
  let resp
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (e) {
    const reason = navigator.onLine === false ? '设备当前离线' : '服务器无响应（可能在休眠）'
    const { ElMessage } = await import('element-plus')
    ElMessage.error(`${reason}，下载失败`)
    throw e
  }

  if (!resp.ok) {
    // 尝试读 JSON 错误
    const text = await resp.text().catch(() => '')
    let msg = `下载失败 (HTTP ${resp.status})`
    if (text) {
      try {
        const j = JSON.parse(text)
        if (j?.msg) msg = j.msg
        else if (j?.message) msg = j.message
      } catch (_) {
        // text 不是 JSON，截前 80 字当提示
        msg = text.length > 80 ? msg + '：' + text.slice(0, 80) + '...' : msg + '：' + text
      }
    }
    const { ElMessage } = await import('element-plus')
    if (resp.status === 401) {
      localStorage.removeItem('token')
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(msg)
    }
    throw new Error(msg)
  }

  // 从 Content-Disposition 取文件名（支持 filename* / filename / 中文）
  let filename = defaultName
  const dispo = resp.headers.get('Content-Disposition') || resp.headers.get('content-disposition') || ''
  if (dispo) {
    // 优先 RFC 5987: filename*=UTF-8''<percent-encoded>
    const star = dispo.match(/filename\*\s*=\s*[\w-]+\*?''([^"';]+)/i)
    if (star) {
      try { filename = decodeURIComponent(star[1]) } catch (_) {}
    } else {
      const m = dispo.match(/filename\s*=\s*["']?([^"';]+)["']?/i)
      if (m) filename = decodeURIComponent(m[1])
    }
  }

  const blob = await resp.blob()
  downloadBlob(blob, filename)
  return { filename, size: blob.size }
}
