<template>
  <div class="task-list">
    <!-- 工具栏 -->
    <el-card shadow="never" class="toolbar">
      <div class="left">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新增任务
        </el-button>
        <el-button @click="openManageSubjects">
          <el-icon><Setting /></el-icon> 管理任务
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="filterSubject" placeholder="全部科目" clearable style="width: 140px" @change="applyFilter">
          <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 130px" @change="applyFilter">
          <el-option label="进行中" value="OPEN" />
          <el-option label="已结束" value="CLOSED" />
          <el-option label="草稿" value="DRAFT" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索任务标题" clearable style="width: 180px" @input="applyFilter">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <div class="right">
        <el-button text @click="load"><el-icon><Refresh /></el-icon> 刷新</el-button>
        <span class="count">共 {{ filteredTasks.length }} 个任务</span>
      </div>
    </el-card>

    <!-- 任务表格 -->
    <el-card shadow="never">
      <el-table :data="pagedTasks" stripe @sort-change="onSort">
        <el-table-column prop="title" label="任务标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="subjectName" label="科目" width="90" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ typeText[row.type] || row.type }}</template>
        </el-table-column>
        <el-table-column prop="creditValue" label="学分" width="70" sortable="custom" />
        <el-table-column label="状态" width="96">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="light">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="截止时间" min-width="140" prop="deadline" sortable="custom">
          <template #default="{ row }">
            <span :class="{ overdue: row.status !== 'CLOSED' && isOverdue(row.deadline) }">{{ row.deadline || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="完成情况" min-width="110">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCompletions(row)">
              <el-icon><View /></el-icon> 查看完成情况
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-popover placement="top" :width="280" trigger="click" :disabled="!row.description">
              <template #reference>
                <el-button link type="info"><el-icon><InfoFilled /></el-icon> 说明</el-button>
              </template>
              <div class="desc-popover">{{ row.description || '（无说明）' }}</div>
            </el-popover>
            <el-button link type="primary" @click="openEdit(row)"><el-icon><Edit /></el-icon> 编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)"><el-icon><Delete /></el-icon> 删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="filteredTasks.length > pageSize">
        <el-pagination
          layout="prev, pager, next"
          :total="filteredTasks.length"
          :page-size="pageSize"
          v-model:current-page="page"
          small
          background
        />
      </div>
    </el-card>

    <!-- 新建 / 编辑任务（会从「管理任务」弹窗内打开，必须 append-to-body，否则内层遮罩盖不住外层弹窗 → 文字重影） -->
    <el-dialog v-model="formVisible" :title="editingId ? '编辑任务' : '新建任务'" width="520px" class="mobile-fit" append-to-body destroy-on-close>
      <el-form :model="form" label-width="84px">
        <el-form-item label="标题"><el-input v-model="form.title" placeholder="如：黑板报设计、卫生值日、班级活动等" /></el-form-item>
        <el-form-item label="科目">
          <div class="subject-pick">
            <el-select v-model="form.subjectId" style="flex:1" @change="onSubjectChange" placeholder="选择科目">
              <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
            <el-button @click="addCustomSubject" title="其他科目可无限添加">
              <el-icon><Plus /></el-icon> 其他
            </el-button>
          </div>
          <div class="subject-hint" v-if="isCustomCategory">已选「其他」：可点上方「其他」按钮无限添加自定义科目</div>
        </el-form-item>
        <el-form-item v-if="isCustomCategory" label="自定义类别">
          <el-input v-model="form.customCategory" placeholder="输入自定义类别名称（如：劳动实践、班级事务）" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="作业" value="HOMEWORK" />
            <el-option label="背书" value="BACKING" />
            <el-option label="测验" value="EXAM" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="进行中" value="OPEN" />
            <el-option label="已结束" value="CLOSED" />
            <el-option label="草稿" value="DRAFT" />
          </el-select>
        </el-form-item>
        <el-form-item label="学分"><el-input-number v-model="form.creditValue" :min="0" /></el-form-item>
        <el-form-item label="截止时间"><el-date-picker v-model="form.deadline" type="datetime" style="width: 100%" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 查看完成情况（同上：可能嵌套打开） -->
    <el-dialog v-model="compVisible" title="完成情况" width="560px" class="mobile-fit" append-to-body>
      <div class="comp-summary" v-if="currentTask">
        <span class="comp-title">{{ currentTask.title }}</span>
        <el-tag size="small" effect="plain">已交/登记 {{ completions.length }} 人</el-tag>
        <el-tag size="small" type="success" effect="plain">完成 {{ doneTotal }} 人</el-tag>
      </div>
      <el-table :data="completions" stripe max-height="360" v-loading="compLoading">
        <el-table-column prop="studentName" label="学生" min-width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="compStatusType(row.status)" size="small" effect="light">{{ compStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="完成时间" min-width="130">
          <template #default="{ row }">{{ row.completionTime || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!isDone(row.status)"
              link type="primary"
              :loading="regId === row.id"
              @click="quickComplete(row)"
            >登记完成</el-button>
            <span v-else class="done-mark">✓</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!compLoading && completions.length === 0" description="暂无完成记录" />
      <template #footer>
        <el-button @click="compVisible = false">关闭</el-button>
        <el-button @click="loadCompletions"><el-icon><Refresh /></el-icon> 刷新</el-button>
      </template>
    </el-dialog>

    <!-- 管理任务弹窗：左侧科目列表 + 右侧该科目下任务管理 -->
    <el-dialog v-model="manageVisible" title="管理任务" width="780px">
      <div class="manage-layout">
        <!-- 左侧：科目列表 -->
        <div class="subject-aside">
          <div class="aside-header">
            <span class="aside-title">科目</span>
            <el-button size="small" type="primary" @click="addCustomSubject" style="padding: 4px 10px; font-size: 12px;">
              <el-icon style="margin-right:2px"><Plus /></el-icon>添加
            </el-button>
          </div>
          <el-scrollbar>
            <div
              v-for="s in subjects"
              :key="s.id"
              :class="['subject-item', selectedManageSubject?.id === s.id && 'active']"
              @click="selectManageSubject(s)"
            >
              <span class="subject-name">{{ s.name }}</span>
              <el-tag size="small" type="info" effect="plain" class="subject-count-tag">
                {{ subjectTaskCount(s.id) }}
              </el-tag>
            </div>
            <div v-if="!subjects.length" class="empty-aside">暂无科目</div>
          </el-scrollbar>
        </div>

        <!-- 右侧：该科目下任务列表 -->
        <div class="task-main">
          <div class="main-header" v-if="selectedManageSubject">
            <span class="main-title">{{ selectedManageSubject.name }} · 任务</span>
            <div class="main-actions">
              <el-button size="small" type="primary" @click="openCreateForSubject">
                <el-icon><Plus /></el-icon> 新增任务
              </el-button>
              <el-button size="small" @click="load">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </div>
          <div v-if="!selectedManageSubject" class="empty-main">
            <span>请从左侧选择科目</span>
          </div>
          <el-table
            v-else
            :data="selectedManageTasks"
            stripe
            max-height="380"
            :empty-text="'该科目下暂无任务，点击右上角「新增任务」添加'"
          >
            <el-table-column prop="title" label="任务标题" min-width="160" show-overflow-tooltip />
            <el-table-column label="类型" width="80">
              <template #default="{ row }">{{ typeText[row.type] || row.type }}</template>
            </el-table-column>
            <el-table-column label="状态" width="88">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small" effect="light">{{ statusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="creditValue" label="学分" width="64" align="center" />
            <el-table-column label="截止时间" min-width="120">
              <template #default="{ row }">
                <span :class="{ overdue: row.status !== 'CLOSED' && isOverdue(row.deadline) }">{{ row.deadline || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row); manageVisible = false">
                  <el-icon><Edit /></el-icon> 编辑
                </el-button>
                <el-button link type="danger" @click="onDelete(row); load()">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <!-- 科目统计摘要 -->
          <div class="subject-stats" v-if="selectedManageSubject">
            <el-tag size="small" type="info" effect="plain">全部 {{ subjectStats.total }}</el-tag>
            <el-tag size="small" type="success" effect="light">进行中 {{ subjectStats.open }}</el-tag>
            <el-tag size="small" type="info" effect="light">已结束 {{ subjectStats.closed }}</el-tag>
            <el-tag size="small" type="warning" effect="light">草稿 {{ subjectStats.draft }}</el-tag>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Edit, Delete, View, Search, Refresh, InfoFilled, Setting } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listTasks, createTask, updateTask, deleteTask,
} from '@/api/task'
import { listCompletions, registerCompletion } from '@/api/completion'
import { listSubjects, createSubject } from '@/api/subject'

const tasks = ref([])
const subjects = ref([])
const filterSubject = ref('')
const filterStatus = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = 10

const typeText = { HOMEWORK: '作业', BACKING: '背书', EXAM: '测验', OTHER: '其他' }
const form = ref({ id: null, title: '', subjectId: 1, type: 'HOMEWORK', status: 'OPEN', creditValue: 3, deadline: '', description: '', customCategory: '' })
const editingId = ref(null)
const formVisible = ref(false)
const saving = ref(false)

const compVisible = ref(false)
const currentTask = ref(null)
const completions = ref([])
const compLoading = ref(false)
const regId = ref(null)

const manageVisible = ref(false)
const selectedManageSubject = ref(null)

const selectedManageTasks = computed(() => {
  if (!selectedManageSubject.value) return []
  return tasks.value.filter((t) => t.subjectId === selectedManageSubject.value.id)
})

function subjectTaskCount(sid) {
  return tasks.value.filter((t) => t.subjectId === sid).length
}

const subjectStats = computed(() => {
  if (!selectedManageSubject.value) return { total: 0, open: 0, closed: 0, draft: 0 }
  const subs = tasks.value.filter((t) => t.subjectId === selectedManageSubject.value.id)
  return {
    total: subs.length,
    open: subs.filter((t) => t.status === 'OPEN').length,
    closed: subs.filter((t) => t.status === 'CLOSED').length,
    draft: subs.filter((t) => t.status === 'DRAFT').length,
  }
})

function selectManageSubject(s) {
  selectedManageSubject.value = s
}

function openCreateForSubject() {
  if (!selectedManageSubject.value) return
  editingId.value = null
  form.value = {
    id: null, title: '', subjectId: selectedManageSubject.value.id, type: 'HOMEWORK',
    status: 'OPEN', creditValue: 3, deadline: '', description: '', customCategory: '',
  }
  formVisible.value = true
}

const isCustomCategory = computed(() => subjects.value.find((s) => s.id === form.value.subjectId)?.name === '其他')

const filteredTasks = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    if (filterSubject.value && t.subjectId !== filterSubject.value) return false
    if (filterStatus.value && t.status !== filterStatus.value) return false
    if (kw && !String(t.title).toLowerCase().includes(kw)) return false
    return true
  })
})
const pagedTasks = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredTasks.value.slice(start, start + pageSize)
})

function applyFilter() { page.value = 1 }

function statusText(s) { return s === 'OPEN' ? '进行中' : s === 'CLOSED' ? '已结束' : s === 'DRAFT' ? '草稿' : s }
function statusType(s) { return s === 'OPEN' ? 'success' : s === 'CLOSED' ? 'info' : s === 'DRAFT' ? 'warning' : '' }

function isDone(status) { return ['FINISHED', 'DONE_ONTIME', 'DONE_OVERDUE'].includes(status) }
function isOverdue(deadline) {
  if (!deadline) return false
  const t = new Date(deadline.replace(/-/g, '/')).getTime()
  return !Number.isNaN(t) && t < Date.now()
}

function compStatusText(s) { return isDone(s) ? '已完成' : '未完成' }
function compStatusType(s) { return isDone(s) ? 'success' : 'warning' }

async function load() {
  const r = await listTasks()
  tasks.value = (r.data ?? r)
}
function onSubjectChange() { if (!isCustomCategory.value) form.value.customCategory = '' }

async function loadSubjects() {
  const r = await listSubjects('WEB')
  subjects.value = r.data ?? r
  if (subjects.value.length && !subjects.value.find((s) => s.id === form.value.subjectId)) {
    form.value.subjectId = subjects.value[0].id
  }
}

// 其他选项：可无限添加自定义科目（直接创建 WEB 平台学科）
async function addCustomSubject() {
  const { value } = await ElMessageBox.prompt('输入自定义科目名称（将作为新科目保存，可反复添加）', '添加自定义科目', {
    confirmButtonText: '添加',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '科目名称不能为空',
  }).catch(() => ({ value: null }))
  if (!value) return
  const name = value.trim()
  if (subjects.value.some((s) => s.name === name)) return ElMessage.warning('该科目已存在')
  try {
    const r = await createSubject({ name, platform: 'WEB' })
    await loadSubjects()
    form.value.subjectId = r.data?.id ?? subjects.value.find((s) => s.name === name)?.id
    ElMessage.success(`已添加科目「${name}」`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '添加科目失败')
  }
}

async function openCreate() {
  editingId.value = null
  form.value = { id: null, title: '', subjectId: subjects.value[0]?.id || 1, type: 'HOMEWORK', status: 'OPEN', creditValue: 3, deadline: '', description: '', customCategory: '' }
  formVisible.value = true
}
async function openEdit(row) {
  editingId.value = row.id
  form.value = {
    id: row.id, title: row.title, subjectId: row.subjectId, type: row.type,
    status: row.status, creditValue: row.creditValue, deadline: row.deadline, description: row.description || '', customCategory: '',
  }
  formVisible.value = true
}
async function submitForm() {
  if (!form.value.title.trim()) return ElMessage.warning('请输入任务标题')
  saving.value = true
  const payload = { ...form.value, deadline: fmt(form.value.deadline) }
  if (form.value.customCategory) payload.description = `[${form.value.customCategory}] ${payload.description || ''}`
  try {
    if (editingId.value) await updateTask(editingId.value, payload)
    else await createTask(payload)
    ElMessage.success(editingId.value ? '已保存' : '任务已创建')
    formVisible.value = false
    await load()
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
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}

async function openCompletions(row) {
  currentTask.value = row
  compVisible.value = true
  await loadCompletions()
}
async function loadCompletions() {
  if (!currentTask.value) return
  compLoading.value = true
  try {
    const r = await listCompletions({ taskId: currentTask.value.id })
    completions.value = r.data ?? r
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '加载完成情况失败')
  } finally {
    compLoading.value = false
  }
}
const doneTotal = computed(() => completions.value.filter((x) => isDone(x.status)).length)

async function openManageSubjects() {
  manageVisible.value = true
  selectedManageSubject.value = subjects.value[0] || null
}

async function quickComplete(item) {
  regId.value = item.id
  try {
    await registerCompletion({ taskId: currentTask.value.id, studentIds: [item.studentId], status: 'FINISHED' })
    ElMessage.success(`已登记 ${item.studentName} 完成`)
    await loadCompletions()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '登记失败')
  } finally {
    regId.value = null
  }
}

function onSort() { /* 预留：当前按后端默认顺序，如需前端排序可在此扩展 */ }

function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

onMounted(() => {
  load()
  loadSubjects()
})
</script>

<style scoped>
.toolbar { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.left { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.right { display: flex; align-items: center; gap: 12px; color: var(--text-soft); font-size: 13px; }
.count { white-space: nowrap; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; }
.comp-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.comp-title { font-weight: 600; font-size: 14px; }
.done-mark { color: #10B981; font-weight: 700; }
.overdue { color: #ef4444; }
.subject-pick { display: flex; gap: 8px; width: 100%; align-items: center; }
.subject-hint { font-size: 12px; color: var(--text-soft); line-height: 1.5; margin-top: 4px; }
.desc-popover { font-size: 13px; color: #334155; line-height: 1.7; white-space: pre-wrap; }
.manage-btn { margin-left: 4px; }
.manage-layout { display: flex; gap: 0; height: 460px; }
.subject-aside {
  width: 180px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.aside-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
}
.aside-title { font-size: 13px; font-weight: 600; color: var(--text); }
.subject-aside .el-scrollbar { flex: 1; }
.subject-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  border-bottom: 1px solid #f5f5f5;
  gap: 6px;
}
.subject-item:hover { background: #f0f7ff; }
.subject-item.active { background: #e8f2ff; color: #2563eb; font-weight: 600; }
.subject-item .subject-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subject-count-tag { flex-shrink: 0; }
.empty-aside { padding: 20px 12px; text-align: center; color: #b0b6c0; font-size: 12px; }
.task-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.main-title { font-size: 13px; font-weight: 600; }
.main-actions { display: flex; gap: 8px; }
.empty-main {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #b0b6c0;
  font-size: 13px;
}
.subject-stats {
  display: flex;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
</style>
