<template>
  <div class="sh">
    <div class="sh-head" v-if="streak !== null">
      <div class="sh-flame">
        <el-icon :size="18"><Sunny /></el-icon>
      </div>
      <div class="sh-stat">
        <b>{{ streak }}</b>
        <span>天连续打卡</span>
      </div>
      <div class="sh-sub">近 17 周完成记录 · 越亮代表当日打卡越多</div>
    </div>

    <div class="sh-grid" :class="{ 'sh-dark': isDark }">
      <div class="sh-week" v-for="(week, wi) in weeks" :key="wi">
        <div
          v-for="(cell, ci) in week"
          :key="ci"
          class="sh-cell"
          :class="[cell ? 'lv' + cell.level : 'sh-empty']"
          :title="cell ? `${cell.key} · 完成 ${cell.count} 项` : ''"
        ></div>
      </div>
    </div>

    <div class="sh-legend">
      <span>少</span>
      <i class="sh-cell lv0"></i>
      <i class="sh-cell lv1"></i>
      <i class="sh-cell lv2"></i>
      <i class="sh-cell lv3"></i>
      <i class="sh-cell lv4"></i>
      <span>多</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Sunny } from '@element-plus/icons-vue'

const props = defineProps({
  // [{ day: 'YYYY-MM-DD', count: n }]
  data: { type: Array, default: () => [] },
  streak: { type: Number, default: null },
})

const isDark = ref(false)
function syncTheme() {
  isDark.value = document.documentElement.dataset.theme === 'dark' ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches &&
      !document.documentElement.dataset.theme)
}
let mo = null
onMounted(() => {
  syncTheme()
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncTheme)
  }
  mo = new MutationObserver(syncTheme)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
onBeforeUnmount(() => {
  mo?.disconnect()
  window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener?.('change', syncTheme)
})

function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function levelOf(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

const weeks = computed(() => {
  const map = {}
  for (const h of props.data || []) map[h.day] = h.count
  const N = 119 // 17 周
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  // 从 end 往前 N-1 天，再回退到所在周的周日，保证列对齐
  const start = new Date(end)
  start.setDate(start.getDate() - (N - 1))
  start.setDate(start.getDate() - start.getDay()) // 回退到周日
  const result = []
  let cur = new Date(start)
  let week = []
  while (cur <= end) {
    const key = ymd(cur)
    const inFuture = cur > end
    if (inFuture) {
      week.push(null)
    } else {
      const count = map[key] || 0
      week.push({ key, count, level: levelOf(count) })
    }
    if (week.length === 7) {
      result.push(week)
      week = []
    }
    cur.setDate(cur.getDate() + 1)
  }
  if (week.length) result.push(week)
  return result
})
</script>

<style scoped>
.sh { display: flex; flex-direction: column; gap: 10px; }
.sh-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sh-flame {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--brand-soft); color: var(--brand);
}
.sh-stat { display: flex; align-items: baseline; gap: 6px; }
.sh-stat b { font-size: 20px; color: var(--brand); }
.sh-stat span { font-size: 12px; color: var(--text-soft); }
.sh-sub { font-size: 12px; color: var(--text-muted); margin-left: auto; }

.sh-grid { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 4px; }
.sh-week { display: flex; flex-direction: column; gap: 3px; }
.sh-cell {
  width: 13px; height: 13px; border-radius: 3px;
  background: #ebedf0;
  transition: transform 0.1s ease;
}
.sh-cell.sh-empty { background: transparent; }
.sh-cell:not(.sh-empty):hover { transform: scale(1.25); cursor: default; }
.sh-cell.lv1 { background: #c9b8f0; }
.sh-cell.lv2 { background: #a78bfa; }
.sh-cell.lv3 { background: #8b5cf6; }
.sh-cell.lv4 { background: #6d28d9; }

.sh-dark .sh-cell { background: #21262d; }
.sh-dark .sh-cell.lv1 { background: #4c3a7a; }
.sh-dark .sh-cell.lv2 { background: #6d4bbd; }
.sh-dark .sh-cell.lv3 { background: #8b5cf6; }
.sh-dark .sh-cell.lv4 { background: #a78bfa; }

.sh-legend { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-soft); }
.sh-legend i { width: 13px; height: 13px; border-radius: 3px; }
.sh-legend .lv0 { background: #ebedf0; }
</style>
