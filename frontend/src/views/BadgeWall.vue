<template>
  <div class="badges-page">
    <div class="card intro">
      <div class="title">徽章墙</div>
      <p class="tip">
        坚持打卡解锁徽章。<b>{{ earnedCount }}</b> 枚已获得 / 共 {{ allBadges.length }} 枚。
        最近一次：{{ lastEarnedLabel }}。
      </p>
    </div>

    <div class="loading" v-if="loading">加载中…</div>
    <div class="empty card" v-else-if="allBadges.length === 0">暂无徽章数据</div>

    <div class="grid" v-else>
      <div
        v-for="b in allBadges"
        :key="b.code"
        class="badge"
        :class="{ earned: earnedCodes.has(b.code), locked: !earnedCodes.has(b.code) }"
        :title="earnedCodes.has(b.code) ? '已获得' : '尚未解锁'"
      >
        <div class="badge-icon">
          <el-icon :size="28"><Trophy v-if="earnedCodes.has(b.code)" /></el-icon>
          <el-icon :size="28"><Lock v-else /></el-icon>
        </div>
        <div class="badge-name">{{ b.name }}</div>
        <div class="badge-desc">{{ b.description }}</div>
        <div class="badge-meta" v-if="earnedCodes.has(b.code)">
          <el-tag size="small" type="success" effect="light">已获得</el-tag>
          <span class="earn-date">解锁于 {{ formatDate(earnedMap[b.code]?.earnedAt) }}</span>
        </div>
        <div class="badge-meta" v-else>
          <el-tag size="small" type="info" effect="plain">未解锁</el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Trophy, Lock } from '@element-plus/icons-vue'
import { listAllBadges, listMyBadges } from '@/api/badge'

const loading = ref(true)
const allBadges = ref([])
const earnedList = ref([])

const earnedCodes = computed(() => new Set(earnedList.value.map((b) => b.code)))
const earnedMap = computed(() => {
  const m = {}
  for (const b of earnedList.value) m[b.code] = b
  return m
})
const earnedCount = computed(() => earnedList.value.length)
const lastEarnedLabel = computed(() => {
  if (earnedList.value.length === 0) return '暂无'
  const last = [...earnedList.value].sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))[0]
  return `${last.name} · ${formatDate(last.earnedAt)}`
})

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const [allR, myR] = await Promise.all([listAllBadges(), listMyBadges()])
    allBadges.value = allR.data || allR || []
    earnedList.value = myR.data || myR || []
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.badges-page { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
.intro .title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.intro .tip { font-size: 13px; color: var(--text-soft); }
.loading, .empty { text-align: center; color: var(--text-soft); padding: 28px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.badge {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.badge:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
.badge.earned { border-color: var(--brand); background: linear-gradient(135deg, #fffaf0 0%, #fff5e6 100%); }
.badge.locked { opacity: 0.6; filter: grayscale(0.4); }
.badge-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge.locked .badge-icon {
  background: #f1f3f7;
  color: #8a94a6;
}
.badge-name { font-size: 14px; font-weight: 600; }
.badge-desc { font-size: 12px; color: var(--text-soft); flex: 1; }
.badge-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.earn-date { color: var(--text-soft); }
</style>
