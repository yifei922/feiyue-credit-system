<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="8" v-for="c in cards" :key="c.title">
        <el-card shadow="hover" class="stat">
          <div class="stat-title">{{ c.title }}</div>
          <div class="stat-value">{{ c.value }}</div>
          <div class="stat-sub">{{ c.sub }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="charts">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <div class="card-head">
            <span class="card-title">各科目完成率对比</span>
            <span class="card-tip">点击柱体下钻查看任务明细</span>
          </div>
          <EChart :option="barOption" height="320px" @chart-click="onBarClick" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <div class="card-head">
            <span class="card-title">任务完成状态分布</span>
            <span class="card-tip">点击扇区下钻查看学生明细</span>
          </div>
          <EChart :option="pieOption" height="320px" @chart-click="onPieClick" />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="chart-card">
      <div class="card-head">
        <span class="card-title">学生学分积累趋势</span>
        <el-select v-model="trendStudent" size="small" style="width: 140px" @change="loadTrend">
          <el-option v-for="s in students" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <EChart :option="lineOption" height="300px" />
    </el-card>

    <!-- 下钻弹窗 -->
    <el-dialog v-model="drillVisible" :title="drillTitle" width="560px">
      <el-table :data="drillRows" size="small" max-height="360" empty-text="暂无数据">
        <el-table-column prop="taskTitle" label="任务" v-if="drillMode === 'subject'" />
        <el-table-column prop="title" label="任务" v-if="drillMode === 'status'" />
        <el-table-column prop="studentName" label="学生" />
        <el-table-column prop="status" label="状态" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import EChart from '@/components/EChart.vue'
import { dashboardOverview, creditTrend, drillDownSubject, drillDownStatus } from '@/api/dashboard'
import { listStudents } from '@/api/student'

const overview = ref({ subjectCompletionRate: [], statusDistribution: { unfinished: 0, ontime: 0, overdue: 0, failed: 0 }, summary: {} })
const students = ref([])
const trendStudent = ref(1)
const trend = ref([])
const drillVisible = ref(false)
const drillTitle = ref('')
const drillRows = ref([])
const drillMode = ref('subject')

const cards = computed(() => {
  const s = overview.value.summary || {}
  return [
    { title: '在读学生', value: s.studentCount ?? '—', sub: '十班' },
    { title: '本学期任务', value: s.taskCount ?? '—', sub: '进行中' },
    { title: '平均学分', value: s.avgCredits ?? '—', sub: '班级均值' }
  ]
})

const barOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: '{b}<br/>完成率：{c}%' },
  grid: { left: 40, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: overview.value.subjectCompletionRate.map((d) => d.subjectName) },
  yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{
    type: 'bar', barWidth: '46%',
    data: overview.value.subjectCompletionRate.map((d) => d.completionRate),
    itemStyle: { color: '#4f7cff', borderRadius: [6, 6, 0, 0] },
    label: { show: true, position: 'top', formatter: '{c}%' }
  }]
}))

const pieOption = computed(() => {
  const d = overview.value.statusDistribution
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '45%'],
      data: [
        { name: '按时完成', value: d.ontime, itemStyle: { color: '#22c55e' } },
        { name: '逾期完成', value: d.overdue, itemStyle: { color: '#f59e0b' } },
        { name: '未完成', value: d.unfinished, itemStyle: { color: '#ef4444' } },
        { name: '未通过', value: d.failed, itemStyle: { color: '#94a3b8' } }
      ],
      label: { formatter: '{b}\n{c}' }
    }]
  }
})

const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: trend.value.map((t) => t.date) },
  yAxis: { type: 'value', name: '学分' },
  series: [{
    type: 'line', smooth: true, data: trend.value.map((t) => t.credits),
    areaStyle: { color: 'rgba(79,124,255,0.12)' },
    lineStyle: { color: '#4f7cff' }, itemStyle: { color: '#4f7cff' }
  }]
}))

async function loadTrend() {
  const r = await creditTrend(trendStudent.value)
  trend.value = r.data ?? r
}
async function onBarClick(p) {
  const subject = overview.value.subjectCompletionRate[p.dataIndex]
  if (!subject) return
  const sid = await subjectIdByName(subject.subjectName)
  const rows = await drillDownSubject(sid)
  drillMode.value = 'subject'
  drillTitle.value = `${subject.subjectName} · 任务完成明细`
  drillRows.value = (rows.data ?? rows).map((r) => ({ taskTitle: r.title, records: r.records }))
    .flatMap((r) => r.records.map((rec) => ({ taskTitle: r.taskTitle, studentName: rec.studentName, status: rec.status })))
  drillVisible.value = true
}
async function onPieClick(p) {
  const map = { '按时完成': 'DONE_ONTIME', '逾期完成': 'DONE_OVERDUE', '未完成': 'UNFINISHED', '未通过': 'FAILED' }
  const status = map[p.name]
  if (!status) return
  const rows = await drillDownStatus(status)
  drillMode.value = 'status'
  drillTitle.value = `${p.name} · 学生明细`
  drillRows.value = rows.data ?? rows
  drillVisible.value = true
}
async function subjectIdByName(name) {
  const map = { '语文': 1, '数学': 2 }
  return map[name] ?? 1
}

onMounted(async () => {
  const o = await dashboardOverview()
  overview.value = o.data ?? o
  const s = await listStudents()
  students.value = s.data ?? s
  if (students.value.length) trendStudent.value = students.value[0].id
  await loadTrend()
})
</script>

<style scoped>
.stat-title { color: var(--text-soft); font-size: 13px; }
.stat-value { font-size: 30px; font-weight: 600; margin: 6px 0; }
.stat-sub { color: var(--text-soft); font-size: 12px; }
.charts { margin-top: 16px; }
.chart-card { margin-bottom: 16px; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.card-title { font-weight: 600; }
.card-tip { color: var(--text-soft); font-size: 12px; }
</style>
