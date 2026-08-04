<template>
  <div class="completion">
    <el-card shadow="never" class="top">
      <el-form inline>
        <el-form-item label="选择任务">
          <el-select v-model="taskId" placeholder="请选择任务" style="width: 240px" @change="loadStudents">
            <el-option v-for="t in tasks" :key="t.id" :label="`${t.title}（${t.subjectName}）`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="完成状态">
          <el-select v-model="status" style="width: 150px">
            <el-option label="按时完成" value="DONE_ONTIME" />
            <el-option label="逾期完成" value="DONE_OVERDUE" />
            <el-option label="未完成" value="UNFINISHED" />
            <el-option label="未通过" value="FAILED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit" :disabled="!taskId || !selected.length">
            保存登记（{{ selected.length }} 人）
          </el-button>
          <el-button @click="selectAll">全选</el-button>
          <el-button @click="clearSel">清空</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <div class="panel-title">待选学生 <small>（拖拽到右侧）</small></div>
          <draggable :list="available" group="stu" item-key="id" class="drag-area" ghost-class="ghost">
            <template #item="{ element }">
              <div class="stu-chip">{{ element.name }} <span class="no">{{ element.studentNo }}</span></div>
            </template>
          </draggable>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <div class="panel-title">已选学生 <small>（{{ selected.length }} 人）</small></div>
          <draggable :list="selected" group="stu" item-key="id" class="drag-area sel" ghost-class="ghost">
            <template #item="{ element }">
              <div class="stu-chip selected">{{ element.name }} <span class="no">{{ element.studentNo }}</span></div>
            </template>
          </draggable>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import draggable from 'vuedraggable'
import { ElMessage } from 'element-plus'
import { listTasks } from '@/api/task'
import { listStudents } from '@/api/student'
import { registerCompletion } from '@/api/completion'

const tasks = ref([])
const allStudents = ref([])
const available = ref([])
const selected = ref([])
const taskId = ref(null)
const status = ref('DONE_ONTIME')

const selectedIds = computed(() => selected.value.map((s) => s.id))

async function loadStudents() {
  selected.value = []
  const r = await listStudents()
  allStudents.value = r.data ?? r
  available.value = [...allStudents.value]
}
function selectAll() { selected.value = [...allStudents.value]; available.value = [] }
function clearSel() { available.value = [...allStudents.value]; selected.value = [] }

async function submit() {
  if (!taskId.value) return ElMessage.warning('请先选择任务')
  if (!selected.value.length) return ElMessage.warning('请拖拽选择学生')
  const r = await registerCompletion({ taskId: taskId.value, studentIds: selectedIds.value, status: status.value })
  const res = r.data ?? r
  ElMessage.success(`登记完成，影响 ${res.affected ?? selected.value.length} 条，本次获得学分 ${res.gained ?? 0}`)
  await loadStudents()
}

onMounted(async () => {
  const t = await listTasks()
  tasks.value = t.data ?? t
  await loadStudents()
  window.addEventListener('app:save', onSubmit)
  window.addEventListener('app:select-all', onSelectAll)
})
onBeforeUnmount(() => {
  window.removeEventListener('app:save', onSubmit)
  window.removeEventListener('app:select-all', onSelectAll)
})

function onSubmit() { submit() }
function onSelectAll() { selectAll() }
</script>

<style scoped>
.top { margin-bottom: 16px; }
.panel-title { font-weight: 600; margin-bottom: 10px; }
.panel-title small { color: var(--text-soft); font-weight: 400; }
.drag-area {
  min-height: 220px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}
.drag-area.sel { background: #f5f9ff; }
.stu-chip {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: grab;
  user-select: none;
}
.stu-chip.selected { background: var(--brand); color: #fff; border-color: var(--brand); }
.stu-chip .no { opacity: 0.6; font-size: 11px; margin-left: 4px; }
.ghost { opacity: 0.4; }
</style>
