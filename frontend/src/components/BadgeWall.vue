<template>
  <div class="badge-wall">
    <div class="head">
      <div class="title">
        <slot name="title">我的徽章</slot>
      </div>
      <div class="sub">
        已获得 <b class="got-num">{{ earned.length }}</b> / {{ all.length }} 枚
      </div>
    </div>
    <div class="grid">
      <div
        v-for="b in all"
        :key="b.id"
        class="badge-card"
        :class="{ earned: earnedSet.has(b.code) }"
        :title="b.description"
      >
        <div class="badge-icon">
          <el-icon :size="32">
            <component :is="iconMap[b.icon] || Trophy" />
          </el-icon>
        </div>
        <div class="badge-name">{{ b.name }}</div>
        <div class="badge-status">
          <el-tag v-if="earnedSet.has(b.code)" type="success" size="small" effect="dark">已获得</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">未解锁</el-tag>
        </div>
      </div>
      <el-empty v-if="!all.length" description="暂无徽章" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
// 徽章墙（F2）：展示全部徽章 + 已获得徽章
import { computed } from 'vue'
import { Trophy, Medal, Star, Sunny, Lightning, Aim, Bell, Reading, EditPen, Histogram } from '@element-plus/icons-vue'

const props = defineProps({
  all: { type: Array, default: () => [] },
  earned: { type: Array, default: () => [] },
})

const iconMap = { Trophy, Medal, Star, Sunny, Lightning, Aim, Bell, Reading, EditPen, Histogram }

const earnedSet = computed(() => new Set(props.earned.map((b) => b.code)))
</script>

<style scoped>
.badge-wall {
  background: var(--surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.title { font-weight: 600; font-size: var(--text-lg); }
.sub { color: var(--text-soft); font-size: var(--text-sm); }
.got-num { color: var(--brand); font-size: var(--text-xl); margin: 0 4px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
}
.badge-card {
  padding: var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all 0.18s ease;
  opacity: 0.55;
  filter: grayscale(0.7);
}
.badge-card.earned {
  opacity: 1;
  filter: none;
  background: linear-gradient(135deg, var(--brand-soft), #fff8e6);
  border-color: var(--brand);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.badge-icon {
  color: var(--text-soft);
  margin-bottom: var(--space-2);
}
.badge-card.earned .badge-icon {
  color: var(--brand);
}
.badge-name {
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: 4px;
}
</style>