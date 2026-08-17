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

// mount 完成时平滑移除启动画屏：由 JS 控制淡出，避免「固定 1.6s 定时器」
// 在冷启动（bundle 未加载完）就提前淡出露出白屏，也避免热加载瞬间消失「闪一下」。
// 最短展示 500ms 保证品牌露出，淡出动画 0.35s 后移除 DOM 节点。
app.config.errorHandler = (err) => {
  console.error('[app] error:', err)
}
import { nextTick } from 'vue'
nextTick(() => {
  const MIN_SHOW = 500
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const hide = () => {
    const sp = document.getElementById('splash')
    if (!sp) return
    sp.classList.add('splash-hide')
    setTimeout(() => { if (sp.parentNode) sp.parentNode.removeChild(sp) }, 380)
  }
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start
  setTimeout(hide, Math.max(0, MIN_SHOW - elapsed))
})
