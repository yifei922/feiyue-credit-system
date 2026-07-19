// 全局快捷键（指令7）：Ctrl+S 保存、Ctrl+A 全选（完成登记页）
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
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
