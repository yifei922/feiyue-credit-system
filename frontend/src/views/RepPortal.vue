<template>
  <div class="rep-portal">
    <!-- 顶部信息卡 -->
    <el-card shadow="never" class="hero">
      <div class="hero-left">
        <div class="hero-icon"><el-icon><Medal /></el-icon></div>
        <div>
          <div class="hero-title">课代表工作台</div>
          <div class="hero-sub">负责学科：<el-tag v-for="s in managedSubjects" :key="s.id" size="small" type="success" effect="plain" class="subj-tag">{{ s.name }}</el-tag>
            <span v-if="!managedSubjects.length" class="muted">暂未分配学科（请管理员在「人员管理」中指派）</span>
          </div>
        </div>
      </div>
      <div class="hero-right">
        <el-button type="primary" :icon="Plus" :disabled="!managedSubjects.length" @click="openCreate">布置任务</el-button>
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
      </div>
    </el-card>

    <!-- 任务概览（学科分组） -->
    <el-row :gutter="14" class="overview">
      <el-col :xs="12" :sm="6" v-for="s in managedSubjects" :key="s.id">
        <el-card shadow="hover" class="stat-card clickable" :class="{ active: selectedSubjectId === s.id }" @click="selectSubject(s.id)">
          <div class="stat-label">{{ s.name }}</div>
          <div class="stat-value">{{ subjectStats[s.id]?.open || 0 }}<span class="stat-unit">进行中</span></div>
          <div class="stat-meta">
            <el-tag size="small" type="info" effect="plain">{{ subjectStats[s.id]?.total || 0 }} 总</el-tag>
            <el-tag size="small" type="success" effect="light">{{ subjectStats[s.id]?.open || 0 }} 进行中</el-tag>
            <el-tag size="small" effect="light">{{ subjectStats[s.id]?.closed || 0 }} 已结束</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 任务列表 -->
    <el-card shadow="never" class="task-card">
      <template #header>
        <div class="card-header">
          <span class="title">任务列表</span>
          <span class="subtitle" v-if="selectedSubjectId">
            当前筛选：{{ managedSubjects.find((s) => s.id === selectedSubjectId)?.name }}
          </span>
          <div class="filter">
            <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 120px">
              <el-option label="进行中" value="OPEN" />
              <el-option label="已结束" value="CLOSED" />
              <el-option label="草稿" value="DRAFT" />
            </el-select>
            <el-input v-model="keyword" placeholder="搜索任务标题" clearable style="width: 180px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table :data="filteredTasks" stripe class="task-tbl" empty-text="暂无任务，点击右上角「布置任务」">
        <el-table-column prop="title" label="任务标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="学科" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" type="success">{{ row.subjectName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ typeText[row.type] || row.type }}</template>
        </el-table-column>
        <el-table-column prop="creditValue" label="学分" width="70" align="center" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="light">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="截止时间" min-width="140">
          <template #default="{ row }">
            <span :class="{ overdue: row.status !== 'CLOSED' && isOverdue(row.deadline) }">{{ row.deadline || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)"><el-icon><Edit /></el-icon> 编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)"><el-icon><Delete /></el-icon> 删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 布置/编辑任务弹窗（任务 3 要求：学科必填，课代表只能选自己负责的学科） -->
    <el-dialog v-model="formVisible" :title="editingId ? '编辑任务' : '布置新任务'" width="520px" class="mobile-fit">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="如：一周阅读笔记打卡" />
        </el-form-item>
        <el-form-item label="学科" required>
          <el-select v-model="form.subjectId" style="width: 100%" placeholder="请选择学科（课代表仅可选择自己负责的学科）">
            <el-option v-for="s in managedSubjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="作业" value="HOMEWORK" />
            <el-option label="背书" value="BACKING" />
            <el-option label="测验" value="EXAM" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="学分">
          <el-input-number v-model="form.creditValue" :min="0" />
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="form.deadline" type="datetime" style="width: 100%" placeholder="选填" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">{{ editingId ? '保存' : '布置' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Search, Refresh, Medal } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { listTasks, createTask, updateTask, deleteTask } from '@/api/task'
import { listSubjects } from '@/api/subject'

const auth = useAuthStore()
const typeText = { HOMEWORK: '作业', BACKING: '背书', EXAM: '测验', OTHER: '其他' }

const tasks = ref([])
const subjects = ref([])
const selectedSubjectId = ref(null)
const filterStatus = ref('')
const keyword = ref('')
const formVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref({ title: '', subjectId: null, type: 'HOMEWORK', creditValue: 3, deadline: null, description: '' })

// 仅展示 REP 用户关联的学科 + （ADMIN/TEACHER 全部）
const managedSubjects = computed(() => {
  if (auth.role === 'ADMIN' || auth.role === 'TEACHER') return subjects.value
  // REP：仅返回该用户负责的学科（subjectIds 由后端在 login /me 中给出）
  const ids = auth.user?.subjectIds || auth.user?.managedSubjects || []
  if (!ids.length) return []
  return subjects.value.filter((s) => ids.includes(s.id))
})

const subjectStats = computed(() => {
  const m = {}
  for (const s of managedSubjects.value) m[s.id] = { total: 0, open: 0, closed: 0, draft: 0 }
  for (const t of tasks.value) {
    if (!m[t.subjectId]) continue
    m[t.subjectId].total++
    if (t.status === 'OPEN') m[t.subjectId].open++
    else if (t.status === 'CLOSED') m[t.subjectId].closed++
    else if (t.status === 'DRAFT') m[t.subjectId].draft++
  }
  return m
})

const filteredTasks = computed(() => {
  return tasks.value.filter((t) => {
    if (selectedSubjectId.value && t.subjectId !== selectedSubjectId.value) return false
    if (filterStatus.value && t.status !== filterStatus.value) return false
    if (keyword.value && !String(t.title).toLowerCase().includes(keyword.value.toLowerCase())) return false
    return true
  })
})

function statusText(s) { return s === 'OPEN' ? '进行中' : s === 'CLOSED' ? '已结束' : s === 'DRAFT' ? '草稿' : s }
function statusType(s) { return s === 'OPEN' ? 'success' : s === 'CLOSED' ? 'info' : s === 'DRAFT' ? 'warning' : '' }
function isOverdue(d) { if (!d) return false; const t = new Date(d.replace(/-/g, '/')).getTime(); return t < Date.now() }

function selectSubject(id) { selectedSubjectId.value = selectedSubjectId.value === id ? null : id }

async function loadAll() {
  const [t, s] = await Promise.all([listTasks(), listSubjects('WEB')])
  tasks.value = t.data ?? t
  subjects.value = s.data ?? s
  // 自动选中第一个负责学科
  if (managedSubjects.value.length && !selectedSubjectId.value) {
    selectedSubjectId.value = managedSubjects.value[0].id
  }
}

function openCreate() {
  if (!managedSubjects.value.length) return ElMessage.warning('暂未分配学科，请联系管理员在「人员管理」中指派')
  editingId.value = null
  form.value = { title: '', subjectId: selectedSubjectId.value || managedSubjects.value[0].id, type: 'HOMEWORK', creditValue: 3, deadline: null, description: '' }
  formVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.value = { title: row.title, subjectId: row.subjectId, type: row.type, creditValue: row.creditValue, deadline: row.deadline, description: row.description || '' }
  formVisible.value = true
}

function fmt(d) {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

async function submitForm() {
  if (!form.value.title.trim()) return ElMessage.warning('请填写任务标题')
  if (!form.value.subjectId) return ElMessage.warning('请选择学科')
  saving.value = true
  try {
    const payload = { ...form.value, deadline: fmt(form.value.deadline) }
    if (editingId.value) await updateTask(editingId.value, payload)
    else await createTask(payload)
    ElMessage.success(editingId.value ? '已保存' : '任务已布置')
    formVisible.value = false
    await loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${row.title}」？删除后完成记录与积分流水一并清除，不可恢复。`, '确认删除', { type: 'warning' })
  } catch (_) { return }
  try {
    await deleteTask(row.id)
    ElMessage.success('已删除')
    await loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

onMounted(async () => {
  // 确保有 subjectIds（首次进入若没拿到，拉一次 /me）
  if (!auth.user?.subjectIds) await auth.refreshMe()
  await loadAll()
})
</script>

<style scoped>
.rep-portal { display: flex; flex-direction: column; gap: 14px; }
.hero { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid rgba(124, 58, 237, 0.15); }
.hero-left { display: flex; align-items: center; gap: 14px; }
.hero-icon { width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #6D28D9); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; }
.hero-title { font-size: 18px; font-weight: 700; color: #2b3242; }
.hero-sub { font-size: 13px; color: #4c3a8c; margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.hero-right { display: flex; gap: 10px; }
.hero :deep(.el-card__body) { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; }
.subj-tag { font-weight: 500; }
.muted { color: #999; font-size: 12px; }
.overview { margin: 0; }
.stat-card { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; border-radius: 10px; }
.stat-card.clickable:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
.stat-card.active { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
.stat-label { font-size: 13px; color: #4c3a8c; font-weight: 600; margin-bottom: 4px; }
.stat-value { font-size: 22px; font-weight: 700; color: #2b3242; }
.stat-unit { font-size: 12px; font-weight: 400; color: #999; margin-left: 6px; }
.stat-meta { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.task-card { border-radius: 10px; }
.card-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.title { font-size: 15px; font-weight: 700; color: #2b3242; }
.subtitle { font-size: 12px; color: #7C3AED; font-weight: 600; }
.filter { margin-left: auto; display: flex; gap: 8px; }
.overdue { color: #ef4444; }
</style>