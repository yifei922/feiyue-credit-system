// 全局 axios 实例 + 拦截器
// 注意：文件下载/导出请走 utils/download.js#downloadBlobApi()，不要走本实例（避免 blob 错误被拦截器误处理）
import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '',
  timeout: 30000
})

// 请求拦截：JWT 自动注入
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：JSON 错误码 → 弹错；网络层错误 → 友好分类提示
request.interceptors.response.use(
  (resp) => {
    // blob/arraybuffer 响应（导出下载）跳过 JSON 检查，由调用方自行处理
    const isBinary = resp.config?.responseType && resp.config.responseType !== 'json'
    if (isBinary) return resp

    const body = resp.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      ElMessage.error(body.msg || '请求失败')
      return Promise.reject(new Error(body.msg || '请求失败'))
    }
    return body
  },
  (error) => {
    // 友好的网络错误分类提示（替代笼统的"网络错误"）
    const status = error.response?.status
    const code = error.code
    const isBlobReq = error.config?.responseType && error.config.responseType !== 'json'

    if (status === 401) {
      localStorage.removeItem('token')
      ElMessage.error('登录已过期，请重新登录')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    if (status === 403) {
      ElMessage.error('无权限访问该资源')
      return Promise.reject(error)
    }
    if (status === 404) {
      ElMessage.error('接口不存在（404），请确认版本一致')
      return Promise.reject(error)
    }
    if (status === 429) {
      ElMessage.error('请求过于频繁，请稍候再试')
      return Promise.reject(error)
    }
    if (status >= 500) {
      ElMessage.error(`服务暂时不可用（HTTP ${status}），请稍候重试`)
      return Promise.reject(error)
    }
    // 没有 status（网络层失败）
    if (code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络后重试')
    } else if (error.message === 'Network Error') {
      ElMessage.error('网络连接中断，请检查网络后重试')
    } else if (typeof status === 'undefined') {
      // onrender 休眠期最常见的错误模式
      const reason = navigator.onLine === false ? '设备当前离线' : '服务器未响应（可能正在休眠/维护）'
      ElMessage.error(`${reason}，请稍候再试`)
      // 静默提示：blob 请求因 fetch 已单独处理，这里不重复弹
      if (isBlobReq) return Promise.reject(error)
    } else {
      ElMessage.error(error.response?.data?.msg || `请求失败 (HTTP ${status})`)
    }
    return Promise.reject(error)
  }
)

export default request
