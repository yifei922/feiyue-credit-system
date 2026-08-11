<template>
  <transition name="page-loading">
    <div v-if="loading" class="page-loading-bar" aria-hidden="true"></div>
  </transition>
</template>

<script setup>
// 路由切换全局进度条（免费，自实现，无需 nprogress 依赖）
// 监听 app:loading-start / app:loading-end 文档事件，由 router 钩子触发
import { ref, onMounted, onBeforeUnmount } from 'vue'

const loading = ref(false)
function onStart() { loading.value = true }
function onEnd() { loading.value = false }

onMounted(() => {
  document.addEventListener('app:loading-start', onStart)
  document.addEventListener('app:loading-end', onEnd)
})
onBeforeUnmount(() => {
  document.removeEventListener('app:loading-start', onStart)
  document.removeEventListener('app:loading-end', onEnd)
})
</script>

<style scoped>
.page-loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 40%;
  background: linear-gradient(90deg, var(--brand), var(--brand-strong));
  z-index: 9999;
  border-radius: 0 3px 3px 0;
  box-shadow: 0 0 8px var(--brand);
  animation: page-load 1s ease-in-out infinite;
}
@keyframes page-load {
  0% { transform: translateX(-100%); left: 0; }
  50% { transform: translateX(150%); left: 0; }
  100% { transform: translateX(350%); left: 0; }
}
.page-loading-enter-active, .page-loading-leave-active {
  transition: opacity 0.2s ease;
}
.page-loading-enter-from, .page-loading-leave-to {
  opacity: 0;
}
</style>