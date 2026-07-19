<template>
  <div class="settings">
    <el-card shadow="never">
      <template #header>
        <span class="h">系统设置 · 操作日志查询</span>
      </template>

      <el-form inline class="filters">
        <el-form-item label="操作人">
          <el-input v-model="q.operatorName" placeholder="姓名模糊" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="q.operateType" placeholder="全部" clearable style="width: 150px">
            <el-option label="新增 INSERT" value="INSERT" />
            <el-option label="修改 UPDATE" value="UPDATE" />
            <el-option label="删除 DELETE" value="DELETE" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker v-model="range" type="datetimerange" range-separator="~" start-placeholder="开始" end-placeholder="结束" style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="logs" stripe max-height="460">
        <el-table-column prop="operatorName" label="操作人" width="120" />
        <el-table-column prop="operateType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.operateType === 'INSERT' ? 'success' : row.operateType === 'DELETE' ? 'danger' : 'warning'">{{ row.operateType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tableName" label="数据表" width="160" />
        <el-table-column prop="recordId" label="记录ID" width="90" />
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column label="操作" fixed="right" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click="showDetail(row)">快照</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailVisible" title="数据快照（修改前后）" width="640px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="修改前">
          <pre class="snap">{{ current.beforeSnapshot || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="修改后">
          <pre class="snap after">{{ current.afterSnapshot || '—' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listOperateLogs } from '@/api/operateLog'

const q = ref({ operatorName: '', operateType: '', startTime: '', endTime: '' })
const range = ref(null)
const logs = ref([])
const detailVisible = ref(false)
const current = ref({})

async function load() {
  if (range.value) {
    q.value.startTime = fmt(range.value[0])
    q.value.endTime = fmt(range.value[1])
  } else {
    q.value.startTime = ''
    q.value.endTime = ''
  }
  const r = await listOperateLogs(q.value)
  const data = r.data ?? r
  logs.value = data.records ?? data
}
function reset() {
  q.value = { operatorName: '', operateType: '', startTime: '', endTime: '' }
  range.value = null
  load()
}
function showDetail(row) { current.value = row; detailVisible.value = true }
function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`
}

onMounted(load)
</script>

<style scoped>
.h { font-weight: 600; }
.filters { margin-bottom: 12px; }
.snap { background: #f5f7fa; padding: 10px; border-radius: 6px; font-size: 12px; white-space: pre-wrap; word-break: break-all; margin: 0; }
.snap.after { background: #f0f9eb; }
</style>
