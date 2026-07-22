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

    <!-- 完成情况小计总览 -->
    <el-card shadow="never" class="chart-card summary-card">
      <div class="card-head">
        <span class="card-title">截止目前 · 任务完成情况总览</span>
        <el-button type="warning" :icon="Bell" :loading="reminding" @click="remindAll">
          一键提醒未完成学生
        </el-button>
      </div>
      <el-row :gutter="12" class="sum-stats">
        <el-col :span="8">
          <div class="sum-box">
            <div class="sum-num">{{ summary.totalStudents }}</div>
            <div class="sum-label">班级总人数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="sum-box done">
            <div class="sum-num">{{ summary.doneStudents }}</div>
            <div class="sum-label">已全部完成</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="sum-box undone">
            <div class="sum-num">{{ summary.unfinishedStudents }}</div>
            <div class="sum-label">尚有未完成</div>
          </div>
        </el-col>
      </el-row>

      <div class="sub-head">各任务完成小计</div>
      <el-table :data="summary.byTask" size="small" stripe max-height="240" empty-text="暂无任务">
        <el-table-column prop="title" label="任务" min-width="160" />
        <el-table-column prop="subjectName" label="科目" width="110" />
        <el-table-column label="已完成 / 未完成" width="150" align="center">
          <template #default="{ row }">
            <el-tag type="success" effect="light" size="small">{{ row.done }}</el-tag>
            <span class="slash">/</span>
            <el-tag type="danger" effect="light" size="small">{{ row.unfinished }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成率" width="140">
          <template #default="{ row }">
            <el-progress :percentage="row.total ? Math.round((row.done / row.total) * 100) : 0" :stroke-width="10" />
          </template>
        </el-table-column>
      </el-table>

      <div class="sub-head">
        未完成学生清单
        <span class="sub-tip" v-if="summary.unfinishedList.length">（点击「单独提醒」可给该生发送提醒）</span>
      </div>
      <el-table :data="summary.unfinishedList" size="small" stripe max-height="260"
                empty-text="太棒了，所有学生均已完成 🎉">
        <el-table-column prop="studentNo" label="学号" width="110" />
        <el-table-column prop="studentName" label="姓名" width="110" />
        <el-table-column prop="pendingCount" label="未完成数" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="danger" effect="plain" size="small">{{ row.pendingCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="待完成任务" min-width="200">
          <template #default="{ row }">{{ row.tasks.join('、') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="remindOne(row)">单独提醒</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell } from '@element-plus/icons-vue'
import EChart from '@/components/EChart.vue'
import { dashboardOverview, creditTrend, drillDownSubject, drillDownStatus, completionSummary } from '@/api/dashboard'
import { remindUnfinished, notifyStudent } from '@/api/alert'
import { listStudents } from '@/api/student'
import { listSubjects } from '@/api/subject'

const overview = ref({ subjectCompletionRate: [], statusDistribution: { unfinished: 0, ontime: 0, overdue: 0, failed: 0 }, summary: {} })
const students = ref([])
const subjects = ref([])
const trendStudent = ref(1)
const trend = ref([])
const drillVisible = ref(false)
const drillTitle = ref('')
const drillRows = ref([])
const drillMode = ref('subject')
const summary = ref({ totalStudents: 0, doneStudents: 0, unfinishedStudents: 0, byTask: [], unfinishedList: [] })
const reminding = ref(false)

async function loadSummary() {
  const r = await completionSummary()
  summary.value = r.data ?? r
}

async function remindAll() {
  if (!summary.value.unfinishedStudents) return ElMessage.info('当前没有未完成的学生')
  reminding.value = true
  try {
    const r = await remindUnfinished()
    const res = r.data ?? r
    ElMessage.success(`已向 ${res.count} 名未完成学生发送提醒`)
  } finally {
    reminding.value = false
  }
}

async function remindOne(row) {
  try {
    const { value } = await ElMessageBox.prompt('提醒内容', `提醒 ${row.studentName}`, {
      inputValue: `你还有 ${row.pendingCount} 项任务未完成：${row.tasks.join('、')}，请尽快完成！`,
      confirmButtonText: '发送', cancelButtonText: '取消'
    })
    await notifyStudent(row.studentId, value)
    ElMessage.success('提醒已发送')
  } catch (e) { /* 取消 */ }
}

const cards = computed(() => {
  const s = overview.value.summary || {}
  return [
    { title: '在读学生', value: s.studentCount ?? '—', sub: '八（十）班' },
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
  const hit = subjects.value.find((s) => s.name === name)
  return hit ? hit.id : (subjects.value[0]?.id ?? 1)
}

onMounted(async () => {
  const o = await dashboardOverview()
  overview.value = o.data ?? o
  const subj = await listSubjects()
  subjects.value = subj.data ?? subj
  const s = await listStudents()
  students.value = s.data ?? s
  if (students.value.length) trendStudent.value = students.value[0].id
  await loadTrend()
  await loadSummary()
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
.summary-card { margin-bottom: 16px; }
.sum-stats { margin: 6px 0 8px; }
.sum-box { text-align: center; padding: 14px 0; border-radius: 10px; background: #f5f7fa; }
.sum-box.done { background: #f0f9eb; }
.sum-box.undone { background: #fef0f0; }
.sum-num { font-size: 28px; font-weight: 700; }
.sum-box.done .sum-num { color: #22c55e; }
.sum-box.undone .sum-num { color: #ef4444; }
.sum-label { font-size: 13px; color: var(--text-soft); margin-top: 2px; }
.sub-head { font-weight: 600; margin: 16px 0 8px; font-size: 14px; }
.sub-tip { font-weight: 400; font-size: 12px; color: var(--text-soft); }
.slash { margin: 0 4px; color: var(--text-soft); }
</style>
