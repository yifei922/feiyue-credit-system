<template>
  <div class="warning">
    <!-- 统计摘要栏 -->
    <div class="stat-bar">
      <div class="stat-card">
        <span class="stat-num">{{ alerts.length }}</span>
        <span class="stat-label">全部预警</span>
      </div>
      <div class="stat-card pending">
        <span class="stat-num">{{ pendingCount }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="stat-card resolved">
        <span class="stat-num">{{ resolvedCount }}</span>
        <span class="stat-label">已解决</span>
      </div>
      <div class="stat-card overdue">
        <span class="stat-num">{{ overdueCount }}</span>
        <span class="stat-label">逾期未完成</span>
      </div>
    </div>

    <el-card shadow="never" class="toolbar">
      <div class="left">
        <el-button type="primary" @click="scan">
          <el-icon><Refresh /></el-icon> 手动触发预警扫描
        </el-button>
        <el-divider direction="vertical" />
        <el-radio-group v-model="filter" @change="load">
          <el-radio-button label="全部" value="ALL" />
          <el-radio-button label="待处理" value="PENDING" />
          <el-radio-button label="已解决" value="RESOLVED" />
        </el-radio-group>
      </div>
      <div class="right">共 {{ filteredAlerts.length }} 条预警</div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="filteredAlerts" stripe>
        <el-table-column prop="studentName" label="学生" width="100" />
        <el-table-column prop="studentNo" label="学号" width="110" />
        <el-table-column label="预警类型" width="160">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" effect="dark" size="small">
              {{ typeIcon(row.type) }} {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="taskTitle" label="关联任务" min-width="160" show-overflow-tooltip />
        <el-table-column label="逾期" width="90" align="center">
          <template #default="{ row }">
            <span v-if="row.overdueDays > 0" class="overdue-badge">{{ row.overdueDays }}天</span>
            <span v-else class="ok-text">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="预警原因" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PENDING' ? 'warning' : 'success'" size="small" effect="light">
              {{ row.status === 'PENDING' ? '待处理' : '已解决' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="生成时间" min-width="150" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" type="primary" size="small" plain @click="resolve(row)">标记解决</el-button>
            <span v-else class="done">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="filteredAlerts.length === 0 && !loading" description="暂无预警记录" style="margin: 24px 0" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listAlerts, resolveAlert, scanAlerts } from '@/api/alert'

const alerts = ref([])
const filter = ref('ALL')
const loading = ref(false)

const filteredAlerts = computed(() => {
  if (filter.value === 'ALL') return alerts.value
  return alerts.value.filter((a) => a.status === filter.value)
})
const pendingCount = computed(() => alerts.value.filter((a) => a.status === 'PENDING').length)
const resolvedCount = computed(() => alerts.value.filter((a) => a.status === 'RESOLVED').length)
const overdueCount = computed(() => alerts.value.filter((a) => a.overdueDays > 0).length)

function typeIcon(t) { return t === 'CONSECUTIVE_MISS' ? '🔴' : '🔶' }
function typeLabel(t) { return t === 'CONSECUTIVE_MISS' ? '连续未完成' : '临近截止' }
function typeTag(t) { return t === 'CONSECUTIVE_MISS' ? 'danger' : 'warning' }

async function load() {
  loading.value = true
  try {
    const r = await listAlerts()
    alerts.value = r.data ?? r
  } finally {
    loading.value = false
  }
}
async function scan() {
  await scanAlerts()
  ElMessage.success('扫描完成，已生成新预警')
  await load()
}
async function resolve(row) {
  await resolveAlert(row.id)
  ElMessage.success('已标记解决')
  await load()
}

onMounted(load)
</script>

<style scoped>
.stat-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-card.pending { border-left: 4px solid #f59e0b; background: #fffbf0; }
.stat-card.resolved { border-left: 4px solid #10B981; background: #f0fdf4; }
.stat-card.overdue { border-left: 4px solid #ef4444; background: #fef2f2; }
.stat-num { font-size: 28px; font-weight: 800; color: #1d2738; line-height: 1; }
.stat-label { font-size: 12px; color: #8a94a6; margin-top: 2px; }
@media (max-width: 640px) { .stat-bar { grid-template-columns: repeat(2, 1fr); } }

.toolbar { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.right { color: var(--text-soft); font-size: 13px; }
.done { color: var(--text-soft); }
.overdue-badge {
  background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 20px;
  padding: 1px 8px; font-size: 12px; font-weight: 600;
}
.ok-text { color: var(--text-soft); }
</style>
