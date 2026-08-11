// 全局快捷键：Ctrl+S 保存、Ctrl+A 全选（完成登记页）、Ctrl+K 命令面板
// 通过 window 自定义事件广播，各页面自行监听处理。
import { onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

export function useShortcuts() {
  const route = useRoute()

  function onKeydown(e) {
    // Ctrl/Cmd + S：阻止浏览器保存，广播保存事件
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('app:save'))
      return
    }
    // Ctrl/Cmd + A：仅在完成登记页阻止默认全选并广播全选事件
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      if (route.path === '/completion') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:select-all'))
      }
      return
    }
    // Ctrl/Cmd + K：打开命令面板（搜索/跳转），阻止浏览器地址栏聚焦
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('app:open-palette'))
      return
    }
    // Esc：关闭命令面板
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('app:close-palette'))
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
