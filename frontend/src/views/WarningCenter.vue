<template>
  <div class="warning">
    <el-card shadow="never" class="toolbar">
      <div class="left">
        <el-button type="primary" @click="scan">
          <el-icon><Refresh /></el-icon> 手动触发预警扫描
        </el-button>
        <el-radio-group v-model="filter" @change="load">
          <el-radio-button label="全部" value="ALL" />
          <el-radio-button label="待处理" value="PENDING" />
          <el-radio-button label="已解决" value="RESOLVED" />
        </el-radio-group>
      </div>
      <div class="right">共 {{ alerts.length }} 条预警</div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="alerts" stripe>
        <el-table-column prop="studentName" label="学生" width="100" />
        <el-table-column prop="studentNo" label="学号" width="110" />
        <el-table-column label="类型" width="148">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" effect="dark">
              {{ typeIcon(row.type) }} {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="taskTitle" label="关联任务" min-width="160" show-overflow-tooltip />
        <el-table-column label="逾期" width="90" align="center">
          <template #default="{ row }">
            <span v-if="row.overdueDays > 0" class="overdue-days">{{ row.overdueDays }}天</span>
            <span v-else class="ok-text">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="预警原因" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PENDING' ? 'info' : 'success'">
              {{ row.status === 'PENDING' ? '待处理' : '已解决' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="生成时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" link type="primary" @click="resolve(row)">标记解决</el-button>
            <span v-else class="done">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listAlerts, resolveAlert, scanAlerts } from '@/api/alert'

const alerts = ref([])
const filter = ref('ALL')

function typeIcon(t) { return t === 'CONSECUTIVE_MISS' ? '🔴' : '🔶' }
function typeLabel(t) { return t === 'CONSECUTIVE_MISS' ? '连续未完成' : '临近截止未完成' }
function typeTag(t) { return t === 'CONSECUTIVE_MISS' ? 'danger' : 'warning' }

async function load() {
  const r = await listAlerts()
  const list = r.data ?? r
  alerts.value = filter.value === 'ALL' ? list : list.filter((a) => a.status === filter.value)
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
.toolbar { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; gap: 12px; align-items: center; }
.right { color: var(--text-soft); font-size: 13px; }
.done { color: var(--text-soft); }
.overdue-days { color: #ef4444; font-weight: 600; font-size: 13px; }
.ok-text { color: var(--text-soft); }
</style>
