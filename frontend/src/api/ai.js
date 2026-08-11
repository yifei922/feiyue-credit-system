// AI 助手 API（FF1 试验性）
// 调用 /api/ai/chat 与 /api/ai/status；当前未配置 LLM 时返回提示信息
export async function aiChat(payload) {
  const token = localStorage.getItem('token') || ''
  const r = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  })
  return r.json()
}

export async function aiStatus() {
  const r = await fetch('/api/ai/status')
  return r.json()
}