<template>
  <div class="manage">
    <!-- 工具条：导入导出 -->
    <div class="toolbar card">
      <div class="toolbar-left">
        <span class="toolbar-title">学生与成绩管理</span>
        <span class="toolbar-tip">管理员 / 老师 / 课代表可用 · 名单含总学分，成绩可批量导入导出</span>
      </div>
      <div class="toolbar-right">
        <input ref="rosterFile" type="file" accept=".csv,.json" class="hidden-file" @change="onRosterFile" />
        <input ref="scoreFile" type="file" accept=".csv,.json" class="hidden-file" @change="onScoreFile" />
        <el-button type="primary" @click="rosterFile?.click()">导入名单</el-button>
        <el-button @click="doExportRoster">导出名单</el-button>
        <el-button type="primary" @click="scoreFile?.click()">导入成绩</el-button>
        <el-button @click="doExportScore">导出成绩</el-button>
        <el-button text @click="loadAll">刷新</el-button>
      </div>
    </div>

    <!-- 导入结果 -->
    <el-alert
      v-if="importResult"
      class="result"
      :type="importResult.skipped > 0 ? 'warning' : 'success'"
      :closable="true"
      show-icon
    >
      <template #title>
        导入完成：成功 {{ importResult.imported }} 条，跳过 {{ importResult.skipped }} 条（共 {{ importResult.total }} 条）
      </template>
      <div v-if="importResult.errors.length" class="err-list">
        <div v-for="(e, i) in importResult.errors" :key="i">· {{ e }}</div>
      </div>
    </el-alert>

    <!-- 学生名单 -->
    <div class="card section">
      <div class="section-head">
        <span class="section-title">学生名单</span>
        <span class="section-sub">共 {{ students.length }} 人</span>
      </div>
      <el-table :data="students" stripe border class="tbl">
        <el-table-column prop="studentNo" label="学号" width="130" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="className" label="班级" />
        <el-table-column prop="totalCredits" label="总学分" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.totalCredits > 0 ? 'success' : 'info'" effect="light">{{ row.totalCredits || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openAdjust(row)">学分增减</el-button>
            <el-button link type="warning" @click="doResetPwd(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 成绩明细 -->
    <div class="card section">
      <div class="section-head">
        <span class="section-title">成绩明细</span>
        <span class="section-sub">共 {{ completions.length }} 条记录</span>
      </div>
      <el-table :data="completions" stripe border class="tbl" max-height="420">
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column prop="studentName" label="姓名" width="120" />
        <el-table-column prop="taskTitle" label="任务" min-width="160" />
        <el-table-column prop="subject" label="科目" width="100" />
        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" effect="light" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creditEarned" label="学分" width="90" align="center" />
        <el-table-column prop="completionTime" label="完成时间" min-width="150" />
      </el-table>
    </div>

    <!-- 学分增减弹窗 -->
    <el-dialog v-model="adjustVisible" :title="`学分增减 · ${adjustForm.name}`" width="420px">
      <el-form label-width="90px">
        <el-form-item label="当前学分">
          <el-tag type="success" effect="light">{{ adjustForm.current }}</el-tag>
        </el-form-item>
        <el-form-item label="调整分值">
          <el-input-number v-model="adjustForm.amount" :step="1" style="width: 100%" />
          <div class="tip-inline">正数为加分，负数为扣分（不能为 0）</div>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="adjustForm.reason" type="textarea" :rows="2" placeholder="如：课堂表现优秀 / 违纪扣分" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdjust">确认调整</el-button>
      </template>
    </el-dialog>

    <!-- 格式说明 -->
    <div class="card hint">
      <div class="hint-title">导入格式说明</div>
      <div><b>名单 CSV</b>：首行可写表头 <code>name,studentNo</code>，或直接从数据行开始（姓名,学号）。自动按学号去重并建账号。</div>
      <div><b>成绩 CSV</b>：表头 <code>student_no,task_id,status</code>（或 <code>student_name,task_title,status</code>）。状态取值：DONE_ONTIME / DONE_OVERDUE / UNFINISHED / FAILED。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listStudents, importStudents, exportStudents, resetStudentPassword } from '@/api/student'
import { listCompletions, importCompletions, exportCompletions } from '@/api/completion'
import { adjustCredit } from '@/api/creditFlow'
import { downloadBlob } from '@/utils/download'
import { statusLabel } from '@/utils/credit'

const students = ref([])
const completions = ref([])
const importResult = ref(null)
const rosterFile = ref(null)
const scoreFile = ref(null)
const adjustVisible = ref(false)
const adjustForm = ref({ studentId: null, name: '', current: 0, amount: 1, reason: '' })

function statusTag(status) {
  return { DONE_ONTIME: 'success', DONE_OVERDUE: 'warning', UNFINISHED: 'info', FAILED: 'danger' }[status] || 'info'
}

async function loadAll() {
  try {
    const [s, c] = await Promise.all([listStudents(), listCompletions()])
    students.value = (s.data || s || []).map((r) => ({
      id: r.id, studentNo: r.studentNo, name: r.name, className: r.className, totalCredits: r.totalCredits
    }))
    completions.value = (c.data || c || []).map((r) => ({
      studentNo: r.studentNo, studentName: r.studentName, taskTitle: r.taskTitle,
      subject: r.subject, status: r.status, creditEarned: r.creditEarned, completionTime: r.completionTime
    }))
  } catch (e) {
    /* 错误已由拦截器提示 */
  }
}

async function onRosterFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const text = await file.text()
  try {
    const res = await importStudents({ csv: text })
    importResult.value = res.data || { imported: 0, skipped: 0, errors: [], total: 0 }
    ElMessage.success(`名单导入成功 ${importResult.value.imported} 条`)
    await loadAll()
  } catch (err) {
    /* 拦截器已提示 */
  } finally {
    e.target.value = ''
  }
}

async function onScoreFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const text = await file.text()
  try {
    const res = await importCompletions({ csv: text })
    importResult.value = res.data || { imported: 0, skipped: 0, errors: [], total: 0 }
    ElMessage.success(`成绩导入成功 ${importResult.value.imported} 条`)
    await loadAll()
  } catch (err) {
    /* 拦截器已提示 */
  } finally {
    e.target.value = ''
  }
}

async function doExportRoster() {
  try {
    const blob = await exportStudents('csv')
    downloadBlob(blob, `students_${Date.now()}.csv`)
    ElMessage.success('名单已导出')
  } catch (e) { /* 拦截器已提示 */ }
}

async function doExportScore() {
  try {
    const blob = await exportCompletions('csv')
    downloadBlob(blob, `completions_${Date.now()}.csv`)
    ElMessage.success('成绩已导出')
  } catch (e) { /* 拦截器已提示 */ }
}

// 重置学生密码
async function doResetPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      `将重置「${row.name}」的登录密码。留空则重置为默认密码 123456。`,
      '重置密码',
      { confirmButtonText: '确认重置', cancelButtonText: '取消', inputPlaceholder: '新密码（留空=123456）' }
    )
    const res = await resetStudentPassword(row.id, value)
    const d = res.data ?? res
    ElMessageBox.alert(`账号：${d.username}\n新密码：${d.password}`, '重置成功', { confirmButtonText: '知道了' })
  } catch (e) { /* 取消或拦截器已提示 */ }
}

// 打开学分调整
function openAdjust(row) {
  adjustForm.value = { studentId: row.id, name: row.name, current: row.totalCredits || 0, amount: 1, reason: '' }
  adjustVisible.value = true
}
async function submitAdjust() {
  const f = adjustForm.value
  if (!f.amount || f.amount === 0) return ElMessage.warning('调整分值不能为 0')
  try {
    const res = await adjustCredit(f.studentId, f.amount, f.reason)
    const d = res.data ?? res
    ElMessage.success(`已调整，${f.name} 当前总学分：${d.total}`)
    adjustVisible.value = false
    await loadAll()
  } catch (e) { /* 拦截器已提示 */ }
}

onMounted(loadAll)
</script>

<style scoped>
.manage { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.toolbar-left { display: flex; flex-direction: column; gap: 4px; }
.toolbar-title { font-size: 16px; font-weight: 600; }
.toolbar-tip { font-size: 12px; color: #8a94a6; }
.toolbar-right { display: flex; gap: 8px; flex-wrap: wrap; }
.hidden-file { display: none; }
.result { border-radius: 12px; }
.err-list { margin-top: 6px; font-size: 12px; color: #b45309; max-height: 120px; overflow: auto; }
.section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.section-title { font-size: 15px; font-weight: 600; }
.section-sub { font-size: 12px; color: #8a94a6; }
.tbl { width: 100%; }
.hint { font-size: 13px; color: #5b6573; line-height: 1.9; }
.hint-title { font-weight: 600; margin-bottom: 4px; color: #2b3242; }
.hint code { background: #f1f3f7; padding: 1px 6px; border-radius: 5px; color: #2563eb; }
.tip-inline { font-size: 12px; color: #8a94a6; margin-top: 4px; }
</style>
