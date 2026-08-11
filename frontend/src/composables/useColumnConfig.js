// 表格列配置持久化 composable（O3）：列宽 / 排序 / 显隐存 localStorage
// 使用方法：
//   const cols = useColumnConfig('student-manage', [
//     { prop: 'name', label: '姓名', width: 120, visible: true },
//     ...
//   ])
//   :data="cols.data"（v-for 列时取 cols.data）

import { ref, computed, onMounted, watch } from 'vue'

const STORAGE_PREFIX = 'colcfg:'

function load(key, defaults) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    // 合并：保留用户改动，未改动项取默认值
    return defaults.map((d) => {
      const saved = parsed.find((p) => p.prop === d.prop)
      return saved ? { ...d, ...saved } : d
    })
  } catch (_) {
    return defaults
  }
}

function save(key, items) {
  try {
    // 只持久化非默认字段，减小存储
    const slim = items.map(({ prop, width, visible, order, sortable, fixed }) =>
      ({ prop, width, visible, order, sortable, fixed }))
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(slim))
  } catch (_) { /* 存储满/隐私模式时静默 */ }
}

export function useColumnConfig(key, defaults) {
  const items = ref(load(key, defaults))

  const visibleItems = computed(() =>
    items.value
      .filter((c) => c.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  )

  function update(prop, patch) {
    const idx = items.value.findIndex((c) => c.prop === prop)
    if (idx < 0) return
    items.value[idx] = { ...items.value[idx], ...patch }
    save(key, items.value)
  }

  function toggle(prop) {
    const col = items.value.find((c) => c.prop === prop)
    if (col) update(prop, { visible: !(col.visible !== false) })
  }

  function reset() {
    items.value = JSON.parse(JSON.stringify(defaults))
    save(key, items.value)
  }

  watch(items, (v) => save(key, v), { deep: true })

  return {
    items,
    visibleItems,
    update,
    toggle,
    reset,
  }
}