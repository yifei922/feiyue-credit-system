<template>
  <div class="student-portal">
    <el-card shadow="never" class="picker">
      <template v-if="isStudent">
        <el-tag type="primary" effect="dark">我的学分主页</el-tag>
      </template>
      <template v-else>
        <span class="label">选择学生：</span>
        <el-select v-model="studentId" style="width: 180px" @change="loadAll">
          <el-option v-for="s in students" :key="s.id" :label="`${s.name}（${s.studentNo}）· 学分${s.totalCredits}`" :value="s.id" />
        </el-select>
      </template>
      <el-tag type="success" effect="plain" class="credit">累计总学分：{{ currentTotal }}</el-tag>
      <el-button type="primary" plain :icon="Download" class="export-btn" @click="exportMine">导出我的成绩单</el-button>
    </el-card>

    <el-tabs v-model="tab" class="tabs">
      <el-tab-pane name="notice">
        <template #label>
          我的提醒
          <el-badge v-if="isStudent && pendingNotices" :value="pendingNotices" class="tab-badge" />
        </template>
        <el-alert
          v-if="!notices.length"
          title="暂无新的提醒 ✅"
          type="success" :closable="false" show-icon
        />
        <div v-for="n in notices" :key="n.id" class="notice-item" :class="{ resolved: n.status === 'RESOLVED' }">
          <el-icon class="notice-ico"><Bell /></el-icon>
          <div class="notice-body">
            <div class="notice-msg">{{ n.reason }}</div>
            <div class="notice-meta">
              <el-tag size="small" :type="n.status === 'PENDING' ? 'warning' : 'info'" effect="plain">
                {{ n.typeText }}
              </el-tag>
              <span class="notice-time">{{ n.createTime }}</span>
              <el-button v-if="isStudent && n.status === 'PENDING'" link type="primary" size="small" @click="markRead(n)">
                知道了
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="积分流水" name="flow">
        <el-table :data="flows" stripe max-height="420">
          <el-table-column prop="createTime" label="时间" width="160" />
          <el-table-column prop="taskTitle" label="来源任务" min-width="160" />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">{{ flowTypeText[row.flowType] }}</template>
          </el-table-column>
          <el-table-column label="变动" width="100" align="right">
            <template #default="{ row }">
              <span :class="row.creditChange >= 0 ? 'plus' : 'minus'">
                {{ row.creditChange >= 0 ? '+' : '' }}{{ row.creditChange }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="推荐任务" name="recommend">
        <el-alert
          v-if="!recs.length"
          title="太棒了，当前没有需要补修的任务 🎉"
          type="success" :closable="false" show-icon
        />
        <el-row :gutter="12">
          <el-col :span="8" v-for="r in recs" :key="r.taskId">
            <el-card shadow="hover" class="rec-card">
              <div class="rec-title">{{ r.title }}</div>
              <div class="rec-meta">
                <el-tag size="small">{{ r.subjectName }}</el-tag>
                <el-tag size="small" type="warning">+{{ r.creditValue }} 学分</el-tag>
              </div>
              <div class="rec-reason">{{ r.reason }}</div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Bell } from '@element-plus/icons-vue'
import { listStudents } from '@/api/student'
import { listCreditFlow } from '@/api/creditFlow'
import { recommendTasks } from '@/api/recommend'
import { exportCompletions } from '@/api/completion'
import { listAlerts, resolveAlert } from '@/api/alert'
import { downloadBlob } from '@/utils/download'
import { flowTypeText } from '@/api/mock'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isStudent = computed(() => auth.user?.role === 'STUDENT')

const students = ref([])
const studentId = ref(null)
const flows = ref([])
const recs = ref([])
const notices = ref([])
const tab = ref('notice')

const pendingNotices = computed(() => notices.value.filter((n) => n.status === 'PENDING').length)

const currentTotal = computed(() => students.value.find((s) => s.id === studentId.value)?.totalCredits ?? '—')

async function loadAll() {
  await loadFlow()
  await loadRec()
  await loadNotices()
}
async function loadNotices() {
  const r = await listAlerts()
  const list = r.data ?? r
  // 学生端后端已按本人过滤；教师/管理员查看所选学生的提醒
  notices.value = isStudent.value ? list : list.filter((a) => a.studentId === studentId.value)
}
async function markRead(n) {
  await resolveAlert(n.id)
  ElMessage.success('已标记为已读')
  await loadNotices()
}
async function loadFlow() {
  const r = await listCreditFlow({ userId: studentId.value })
  flows.value = r.data ?? r
}
async function loadRec() {
  const r = await recommendTasks({ studentId: studentId.value })
  recs.value = r.data ?? r
}

// 导出当前学生的成绩单（学生=本人，教师/课代表=所选学生）
async function exportMine() {
  try {
    const blob = await exportCompletions('csv', { studentId: studentId.value })
    const d = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `我的成绩单_${d}.csv`)
    ElMessage.success('成绩单已导出')
  } catch (e) {
    // 错误提示由响应拦截器统一处理
  }
}

onMounted(async () => {
  const s = await listStudents()
  students.value = s.data ?? s
  if (students.value.length) {
    // 学生身份：默认展示登录者本人；教师/管理员：默认第一位
    studentId.value = isStudent.value ? (auth.user?.studentId ?? students.value[0].id) : students.value[0].id
    await loadAll()
  }
})
</script>

<style scoped>
.picker { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.export-btn { margin-left: auto; }
.label { font-size: 14px; }
.credit { margin-left: 8px; }
.plus { color: #22c55e; font-weight: 600; }
.minus { color: #ef4444; font-weight: 600; }
.rec-card { margin-bottom: 12px; }
.rec-title { font-weight: 600; margin-bottom: 8px; }
.rec-meta { display: flex; gap: 6px; margin-bottom: 8px; }
.rec-reason { color: var(--text-soft); font-size: 12px; }
.tab-badge { margin-left: 4px; }
.notice-item { display: flex; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; background: #fffdf5; }
.notice-item.resolved { background: #fafafa; opacity: 0.7; }
.notice-ico { color: #f59e0b; font-size: 18px; margin-top: 2px; }
.notice-body { flex: 1; }
.notice-msg { font-size: 14px; color: #2b3242; line-height: 1.5; }
.notice-meta { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.notice-time { font-size: 12px; color: var(--text-soft); }
</style>
