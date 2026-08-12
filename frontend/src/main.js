import { createApp } from 'vue'
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
app.mount('#app')

// mount 完成时移除启动画屏（无需等到 CSS fadeOut 2s 结束）
// 用 nextTick 确保 #app 已渲染，避免 loading 期用户仍看到 Splash
app.config.errorHandler = (err) => {
  console.error('[app] error:', err)
}
import { nextTick } from 'vue'
nextTick(() => {
  if (typeof window !== 'undefined' && typeof window.__removeSplash === 'function') {
    window.__removeSplash()
  }
})
