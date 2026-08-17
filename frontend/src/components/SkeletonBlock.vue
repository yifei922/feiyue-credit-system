<template>
  <div class="sk" :style="boxStyle" :class="{ 'sk-circle': circle }"></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  width: { type: [String, Number], default: '100%' },
  height: { type: [String, Number], default: 14 },
  radius: { type: [String, Number], default: 8 },
  circle: { type: Boolean, default: false },
})

const boxStyle = computed(() => {
  const w = typeof props.width === 'number' ? props.width + 'px' : props.width
  const h = typeof props.height === 'number' ? props.height + 'px' : props.height
  const r = typeof props.radius === 'number' ? props.radius + 'px' : props.radius
  return { width: w, height: h, borderRadius: props.circle ? '50%' : r }
})
</script>

<style scoped>
.sk {
  display: inline-block;
  background: linear-gradient(90deg, var(--bg-subtle) 25%, var(--border) 37%, var(--bg-subtle) 63%);
  background-size: 400% 100%;
  animation: sk-shimmer 1.3s ease-in-out infinite;
}
@keyframes sk-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
