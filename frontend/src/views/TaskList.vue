<template>
  <div class="task-list">
    <el-card shadow="never" class="toolbar">
      <div class="left">
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon> 新建任务
        </el-button>
        <el-button @click="openTemplateDialog">
          <el-icon><Files /></el-icon> 从模板创建
        </el-button>
        <el-select v-model="filterSubject" placeholder="全部科目" clearable style="width: 150px" @change="load">
          <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <div class="right">共 {{ tasks.length }} 个任务</div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="filteredTasks" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="任务标题" min-width="160" />
        <el-table-column prop="subjectName" label="科目" width="90" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ typeText[row.type] }}</template>
        </el-table-column>
        <el-table-column prop="creditValue" label="学分" width="70" />
        <el-table-column label="截止时间" min-width="140" prop="deadline" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="saveTemplate(row)">存为模板</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建任务 -->
    <el-dialog v-model="createVisible" title="新建任务" width="500px">
      <el-form :model="form" label-width="80px">
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
        <el-form-item label="学分"><el-input-number v-model="form.creditValue" :min="0" /></el-form-item>
        <el-form-item label="截止时间"><el-date-picker v-model="form.deadline" type="datetime" style="width: 100%" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 从模板创建 -->
    <el-dialog v-model="tplVisible" title="从模板创建任务" width="460px">
      <el-radio-group v-model="selectedTpl">
        <el-radio-button v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</el-radio-button>
      </el-radio-group>
      <template #footer>
        <el-button @click="tplVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFromTemplate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Files } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listTasks, createTask, saveAsTemplate, createFromTemplate, listTemplates } from '@/api/task'
import { listSubjects } from '@/api/subject'

const tasks = ref([])
const subjects = ref([])
const templates = ref([])
const filterSubject = ref('')
const createVisible = ref(false)
const tplVisible = ref(false)
const selectedTpl = ref(null)
const typeText = { HOMEWORK: '作业', BACKING: '背书', EXAM: '测验', OTHER: '其他' }
const form = ref({ title: '', subjectId: 1, type: 'HOMEWORK', creditValue: 3, deadline: '', description: '', customCategory: '' })

// 是否选中"其他"科目（显示自定义类别输入框）
const isCustomCategory = computed(() => {
  const hit = subjects.value.find((s) => s.id === form.value.subjectId)
  return hit?.name === '其他'
})

function onSubjectChange() {
  // 切换到"其他"时清空自定义类别
  if (!isCustomCategory.value) form.value.customCategory = ''
}

const filteredTasks = computed(() =>
  filterSubject.value ? tasks.value.filter((t) => t.subjectId === filterSubject.value) : tasks.value
)

async function load() {
  const r = await listTasks()
  tasks.value = r.data ?? r
}
async function openCreate() { createVisible.value = true }
async function submitCreate() {
  const payload = { ...form.value, deadline: fmt(form.value.deadline) }
  // 自定义类别名称拼接到说明中，便于识别
  if (form.value.customCategory) {
    payload.description = `[${form.value.customCategory}] ${payload.description || ''}`
  }
  await createTask(payload)
  ElMessage.success('任务已创建')
  createVisible.value = false
  await load()
}
async function saveTemplate(row) {
  await saveAsTemplate(row)
  ElMessage.success(`已存为模板：${row.title}·模板`)
  await loadTemplates()
}
async function openTemplateDialog() {
  await loadTemplates()
  selectedTpl.value = templates.value[0]?.id ?? null
  tplVisible.value = true
}
async function submitFromTemplate() {
  if (!selectedTpl.value) return ElMessage.warning('请选择模板')
  await createFromTemplate(selectedTpl.value)
  ElMessage.success('已从模板创建任务')
  tplVisible.value = false
  await load()
}
async function loadTemplates() {
  const r = await listTemplates()
  templates.value = r.data ?? r
}
function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

async function loadSubjects() {
  const r = await listSubjects()
  subjects.value = r.data ?? r
  if (subjects.value.length && !subjects.value.find((s) => s.id === form.value.subjectId)) {
    form.value.subjectId = subjects.value[0].id
  }
}

onMounted(() => {
  load()
  loadSubjects()
  window.addEventListener('app:save', onSave)
})
onBeforeUnmount(() => window.removeEventListener('app:save', onSave))

function onSave() {
  if (!createVisible.value) openCreate()
}
</script>

<style scoped>
.toolbar { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; gap: 10px; align-items: center; }
.right { color: var(--text-soft); font-size: 13px; }
</style>
