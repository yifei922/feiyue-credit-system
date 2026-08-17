import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import './styles/responsive.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// 最短展示 500ms 保证品牌露出，再平滑淡出（复用 index.html 的 __removeSplash，带 CSS 淡出）
function scheduleSplashHide() {
  const MIN_SHOW = 500
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const elapsed = now() - startMark
  setTimeout(() => {
    if (typeof window.__removeSplash === 'function') window.__removeSplash()
  }, Math.max(0, MIN_SHOW - elapsed))
}

const startMark = (typeof performance !== 'undefined' ? performance.now() : Date.now())

try {
  app.mount('#app')
  // 挂载成功：等下一拍确认 DOM 已渲染，再排程淡出
  nextTick(scheduleSplashHide)
} catch (e) {
  // 挂载失败：绝不能让 Splash 永久盖屏——立即强制淡出并暴露错误，便于排错
  console.error('[app] mount failed, forcing splash hide:', e)
  if (typeof window.__removeSplash === 'function') window.__removeSplash()
}

app.config.errorHandler = (err) => {
  console.error('[app] error:', err)
}
