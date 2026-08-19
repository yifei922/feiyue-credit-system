<template>
  <div class="task-list">
    <!-- 工具栏 -->
    <el-card shadow="never" class="toolbar">
      <div class="left">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建任务
        </el-button>
        <el-button @click="openTemplateDialog">
          <el-icon><Files /></el-icon> 从模板创建
        </el-button>
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)"><el-icon><Edit /></el-icon> 编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)"><el-icon><Delete /></el-icon> 删除</el-button>
            <el-button link @click="saveTemplate(row)"><el-icon><Trophy /></el-icon> 存模板</el-button>
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

    <!-- 新建 / 编辑任务 -->
    <el-dialog v-model="formVisible" :title="editingId ? '编辑任务' : '新建任务'" width="520px" class="mobile-fit">
      <el-form :model="form" label-width="84px">
        <el-form-item label="标题"><el-input v-model="form.title" placeholder="如：黑板报设计、卫生值日、班级活动等" /></el-form-item>
        <el-form-item label="科目">
          <el-select v-model="form.subjectId" style="width: 100%" @change="onSubjectChange">
            <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
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

    <!-- 从模板创建 -->
    <el-dialog v-model="tplVisible" title="从模板创建任务" width="460px" class="mobile-fit">
      <el-radio-group v-model="selectedTpl">
        <el-radio-button v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</el-radio-button>
      </el-radio-group>
      <template #footer>
        <el-button @click="tplVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFromTemplate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 查看完成情况 -->
    <el-dialog v-model="compVisible" title="完成情况" width="560px" class="mobile-fit">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Files, Edit, Delete, View, Search, Refresh, Trophy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listTasks, createTask, updateTask, deleteTask, saveAsTemplate, createFromTemplate, listTemplates,
} from '@/api/task'
import { listCompletions, registerCompletion } from '@/api/completion'
import { listSubjects } from '@/api/subject'

const tasks = ref([])
const subjects = ref([])
const templates = ref([])
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
const tplVisible = ref(false)
const selectedTpl = ref(null)

const compVisible = ref(false)
const currentTask = ref(null)
const completions = ref([])
const compLoading = ref(false)
const regId = ref(null)

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
  const r = await listSubjects()
  subjects.value = r.data ?? r
  if (subjects.value.length && !subjects.value.find((s) => s.id === form.value.subjectId)) {
    form.value.subjectId = subjects.value[0].id
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

async function saveTemplate(row) {
  try {
    await saveAsTemplate({ title: row.title, subjectId: row.subjectId, type: row.type, creditValue: row.creditValue, description: row.description })
    ElMessage.success(`已存为模板：${row.title}·模板`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '存为模板失败')
  }
}

async function openTemplateDialog() {
  await loadTemplates()
  selectedTpl.value = templates.value[0]?.id ?? null
  tplVisible.value = true
}
async function loadTemplates() {
  const r = await listTemplates()
  templates.value = r.data ?? r
}
async function submitFromTemplate() {
  if (!selectedTpl.value) return ElMessage.warning('请选择模板')
  try {
    await createFromTemplate(selectedTpl.value)
    ElMessage.success('已从模板创建任务')
    tplVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建失败')
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
</style>
