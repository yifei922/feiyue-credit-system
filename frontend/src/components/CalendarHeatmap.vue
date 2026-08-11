<template>
  <div class="cal-heatmap">
    <div class="cal-head">
      <div class="cal-title">
        <slot name="title">打卡热力图</slot>
      </div>
      <div class="cal-legend">
        <span class="lbl">少</span>
        <span class="cell lvl-0"></span>
        <span class="cell lvl-1"></span>
        <span class="cell lvl-2"></span>
        <span class="cell lvl-3"></span>
        <span class="cell lvl-4"></span>
        <span class="lbl">多</span>
      </div>
    </div>

    <div class="cal-streak">
      当前连续 <b class="streak-num">{{ streak }}</b> 天
      <span v-if="longest > streak" class="streak-best"> · 最长 {{ longest }} 天</span>
    </div>

    <div class="cal-grid">
      <div v-for="(week, wi) in weeks" :key="wi" class="cal-week">
        <div
          v-for="(day, di) in week"
          :key="di"
          class="cell"
          :class="[`lvl-${day.level}`, { 'is-today': day.isToday, 'is-future': day.isFuture, 'is-empty': !day.date }]"
          :title="day.date ? `${day.date}：${day.count} 次打卡` : ''"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 日历热力图组件：渲染最近 N 周的打卡情况 + streak 统计
// 入参：
//   dates: ['2026-08-01', '2026-08-02', ...]  完成日期数组
//   weeks: Number 默认 26（约半年）
import { computed } from 'vue'

const props = defineProps({
  dates: { type: Array, default: () => [] },
  weeks: { type: Number, default: 26 },
})

function toDay(s) {
  return String(s).slice(0, 10)
}

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)

// 把日期数组转成 { 'YYYY-MM-DD': count } 字典
const countMap = computed(() => {
  const m = {}
  for (const d of props.dates || []) {
    const k = toDay(d)
    m[k] = (m[k] || 0) + 1
  }
  return m
})

// 生成最近 N 周（每列 7 天，从右往左推到 today）
const grid = computed(() => {
  const cells = []
  const totalDays = props.weeks * 7
  // 从今天向前推 totalDays-1 天
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = countMap.value[dateStr] || 0
    const isFuture = d > today
    const isToday = dateStr === todayStr
    let level = 0
    if (count >= 4) level = 4
    else if (count === 3) level = 3
    else if (count === 2) level = 2
    else if (count === 1) level = 1
    cells.push({ date: dateStr, count, level, isFuture, isToday })
  }
  // 切分到 weeks 列（每周一列）：先补齐首列（空白填充），再按 7 个一组
  // 让首列第一行（最旧的）对应到周的开始（周日），保持日历对齐
  const firstDate = new Date(cells[0].date)
  const firstDayOfWeek = firstDate.getDay() // 0=周日
  const padded = Array(firstDayOfWeek).fill({ date: null }).concat(cells)
  const result = []
  for (let i = 0; i < padded.length; i += 7) {
    result.push(padded.slice(i, i + 7))
  }
  return result
})

// streak：当前连续打卡天数（从今天往回数）
const streak = computed(() => {
  let n = 0
  const d = new Date(today)
  while (true) {
    const k = d.toISOString().slice(0, 10)
    if ((countMap.value[k] || 0) > 0) {
      n += 1
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return n
})

// 最长连续天数（历史）
const longest = computed(() => {
  let best = 0
  let cur = 0
  // 从最早日期按时间正序遍历
  const sorted = Object.keys(countMap.value).sort()
  let prev = null
  for (const k of sorted) {
    if (countMap.value[k] > 0) {
      if (prev) {
        const d1 = new Date(prev)
        const d2 = new Date(k)
        const diff = (d2 - d1) / 86400000
        cur = diff === 1 ? cur + 1 : 1
      } else {
        cur = 1
      }
      best = Math.max(best, cur)
      prev = k
    } else {
      cur = 0
      prev = k
    }
  }
  return best
})

const weeks = computed(() => grid.value)
</script>

<style scoped>
.cal-heatmap {
  background: var(--surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.cal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-soft);
}
.cal-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
}
.cal-legend .cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
.cal-streak {
  font-size: var(--text-base);
  margin-bottom: var(--space-3);
  color: var(--text);
}
.streak-num {
  color: var(--brand);
  font-size: var(--text-xl);
  margin: 0 4px;
}
.streak-best {
  color: var(--text-soft);
  font-size: var(--text-sm);
  margin-left: 4px;
}
.cal-grid {
  display: flex;
  gap: 3px;
  overflow-x: auto;
}
.cal-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #ebedf0;
  transition: transform 0.15s ease;
}
.cell:hover:not(.is-empty):not(.is-future) {
  transform: scale(1.4);
  outline: 1px solid var(--brand);
}
.cell.is-empty {
  background: transparent;
}
.cell.is-future {
  opacity: 0.3;
}
.cell.is-today {
  outline: 2px solid var(--brand);
}
.lvl-0 { background: #ebedf0; }
.lvl-1 { background: #fce4e6; }
.lvl-2 { background: #f5a3ad; }
.lvl-3 { background: #e85d6e; }
.lvl-4 { background: var(--brand); }
html[data-theme='dark'] .lvl-0 { background: #2d3748; }
html[data-theme='dark'] .lvl-1 { background: #4a2530; }
html[data-theme='dark'] .lvl-2 { background: #7a2a3a; }
html[data-theme='dark'] .lvl-3 { background: #b0304a; }
html[data-theme='dark'] .lvl-4 { background: var(--brand); }
</style>