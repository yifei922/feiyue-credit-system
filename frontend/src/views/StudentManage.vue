<template>
  <div class="manage">
    <!-- 工具条：导入导出（置顶，仅老师/管理员可见） -->
    <div class="toolbar card" v-if="isTeacherOrAdmin">
      <div class="toolbar-left">
        <span class="toolbar-title">人员管理</span>
        <span class="toolbar-tip">管理员 / 教师可用 · 含学生、教师、课代表三类账号的增删改与密码重置</span>
      </div>
      <div class="toolbar-right">
        <input ref="rosterFile" type="file" accept=".csv,.json" class="hidden-file" @change="onRosterFile" />
        <el-button type="primary" @click="rosterFile?.click()">导入名单</el-button>
        <el-button @click="doExportRoster">导出名单</el-button>
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

    <!-- 三标签：学生 / 教师 / 课代表 -->
    <el-tabs v-model="activeTab" class="card tabs-card">
      <!-- ====== 学生管理 ====== -->
      <el-tab-pane label="学生" name="students">
        <div class="section-head">
          <span class="section-title">学生账号</span>
          <span class="section-sub">共 {{ students.length }} 人</span>
          <div class="batch-bar" v-if="selected.length > 0">
            <el-tag effect="light" type="info">已选 {{ selected.length }} 人</el-tag>
            <el-button v-if="isTeacherOrAdmin" size="small" type="warning" @click="batchResetPwd">批量重置密码</el-button>
            <el-button v-if="isTeacherOrAdmin" size="small" type="danger" @click="batchSoftDelete">批量删除（可恢复）</el-button>
            <el-button size="small" text @click="selected = []">取消选择</el-button>
          </div>
          <div class="batch-bar ml-auto">
            <el-button v-if="isTeacherOrAdmin" size="small" type="primary" @click="addStudentVisible = true"><el-icon><Plus /></el-icon> 新增学生</el-button>
          </div>
        </div>
        <el-table :data="students" stripe border class="tbl" @selection-change="onSelectionChange">
          <el-table-column type="selection" width="48" />
          <el-table-column prop="studentNo" label="学号" width="130" />
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column prop="className" label="班级" />
          <el-table-column prop="totalCredits" label="总学分" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.totalCredits > 0 ? 'success' : 'info'" effect="light">{{ row.totalCredits || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openAdjust(row)">学分增减</el-button>
              <el-button v-if="isTeacherOrAdmin" link type="warning" @click="doResetPwd(row)">重置密码</el-button>
              <el-button v-if="isTeacherOrAdmin" link type="danger" @click="doDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 成绩明细（附属在学生Tab下） -->
        <div class="section-head" style="margin-top:24px">
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
      </el-tab-pane>

      <!-- ====== 教师管理 ====== -->
      <el-tab-pane label="教师" name="teachers">
        <div class="section-head">
          <span class="section-title">教师账号</span>
          <span class="section-sub">共 {{ teachers.length }} 名教师，可新增老师、批量重置密码、删除账号</span>
          <div class="batch-bar ml-auto">
            <el-button size="small" type="primary" @click="addTeacherVisible = true"><el-icon><Plus /></el-icon> 新增老师</el-button>
          </div>
        </div>
        <el-table :data="teachers" stripe border class="tbl">
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column label="角色" width="120">
            <template #default>
              <el-tag effect="light" type="warning">教师</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240">
            <template #default="{ row }">
              <el-button link type="warning" @click="resetTeacherPwd(row)">重置密码</el-button>
              <el-button v-if="isAdmin" link type="danger" @click="removeTeacher(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ====== 课代表管理 ====== -->
      <el-tab-pane label="课代表" name="reps">
        <div class="section-head">
          <span class="section-title">科目与课代表</span>
          <span class="section-sub">围绕初二学科体系 · 教师/管理员可为每个科目设置课代表或添加自定义科目</span>
          <div class="batch-bar ml-auto">
            <el-button size="small" type="primary" @click="addCustomSubject"><el-icon><Plus /></el-icon> 添加科目</el-button>
          </div>
        </div>
        <el-table :data="subjects" stripe border class="tbl" max-height="480">
          <el-table-column prop="name" label="科目" width="120" />
          <el-table-column label="课代表" min-width="200">
            <template #default="{ row }">
              <el-tag v-for="(n, i) in (row.repNames || [])" :key="i" class="rep-tag" type="primary" effect="light">{{ n }}</el-tag>
              <span v-if="!row.repNames || !row.repNames.length" class="muted">未设置</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRepDialog(row)">设置课代表</el-button>
              <el-button link type="danger" @click="removeSubject(row)">删除科目</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="hint-box">
          提示：候选课代表来自「教师」列表中的账号。如需新增课代表，请先到「教师」标签页新增教师身份账号。
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增老师弹窗 -->
    <el-dialog v-model="addTeacherVisible" title="新增教师账号" width="440px">
      <el-form label-width="90px">
        <el-form-item label="姓名"><el-input v-model="teacherForm.name" placeholder="教师真实姓名" /></el-form-item>
        <el-form-item label="用户名"><el-input v-model="teacherForm.username" placeholder="字母数字下划线，3-32位" /></el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="teacherForm.password" type="password" show-password placeholder="留空则生成随机临时密码（至少8位）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addTeacherVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTeacher" @click="submitTeacher">创建</el-button>
      </template>
    </el-dialog>

    <!-- 新增学生弹窗 -->
    <el-dialog v-model="addStudentVisible" title="新增学生账号" width="440px">
      <el-form label-width="90px">
        <el-form-item label="姓名"><el-input v-model="studentForm.name" placeholder="学生姓名" /></el-form-item>
        <el-form-item label="学号"><el-input v-model="studentForm.studentNo" placeholder="留空则系统自动生成" /></el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="studentForm.password" type="password" show-password placeholder="留空则生成随机临时密码（至少6位）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addStudentVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingStudent" @click="submitStudent">创建</el-button>
      </template>
    </el-dialog>

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

    <!-- 设置课代表弹窗 -->
    <el-dialog v-model="repDialog" :title="`设置「${repTarget.name}」课代表`" width="420px">
      <el-select v-model="repSelected" multiple filterable placeholder="选择课代表账号（可多选）" style="width: 100%">
        <el-option v-for="u in repCandidates" :key="u.id" :label="`${u.name}（${u.username}）`" :value="u.id" />
      </el-select>
      <div class="tip-inline" v-if="!repCandidates.length">暂无教师账号，请先在「教师」标签页新增教师。</div>
      <template #footer>
        <el-button @click="repDialog = false">取消</el-button>
        <el-button type="primary" @click="saveReps">保存</el-button>
      </template>
    </el-dialog>

    <!-- 格式说明 -->
    <div class="card hint">
      <div class="hint-title">导入格式说明</div>
      <div><b>名单 CSV</b>：首行可写表头 <code>name,studentNo</code>，或直接从数据行开始（姓名,学号）。自动按学号去重并建账号。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { listStudents, importStudents, exportStudents, resetStudentPassword, batchResetStudentPassword, restoreStudent, createStudent } from '@/api/student'
import { listCompletions, exportCompletions } from '@/api/completion'
import { adjustCredit } from '@/api/creditFlow'
import { statusLabel } from '@/utils/credit'
import { listSubjects, setSubjectReps, createSubject, deleteSubject } from '@/api/subject'
import { listUsers, createUser, deleteUser, resetPassword } from '@/api/user'

const auth = useAuthStore()
const isTeacherOrAdmin = computed(() => ['TEACHER', 'ADMIN'].includes(auth.role))
const isAdmin = computed(() => auth.role === 'ADMIN')

const students = ref([])
const completions = ref([])
const subjects = ref([])
const repCandidates = ref([])
const teachers = ref([])
const importResult = ref(null)
const rosterFile = ref(null)
const adjustVisible = ref(false)
const adjustForm = ref({ studentId: null, name: '', current: 0, amount: 1, reason: '' })
const selected = ref([])
const addTeacherVisible = ref(false)
const savingTeacher = ref(false)
const teacherForm = ref({ name: '', username: '', password: '' })
const addStudentVisible = ref(false)
const savingStudent = ref(false)
const studentForm = ref({ name: '', studentNo: '', password: '' })

// 新增：Tab 控制 & 课代表弹窗
const activeTab = ref('students')
const repDialog = ref(false)
const repTarget = ref({})
const repSelected = ref([])

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
    if (isTeacherOrAdmin.value) {
      await Promise.all([loadSubjects(), loadTeachers()])
    }
  } catch (e) {
    /* 错误已由拦截器提示 */
  }
}

// 教师账号列表 & 课代表候选（教师=候选课代表）
async function loadTeachers() {
  try {
    const r = await listUsers('TEACHER')
    teachers.value = r.data || r || []
    // 教师账号同时作为课代表候选
    repCandidates.value = teachers.value
  } catch (e) { /* 拦截器已提示 */ }
}

// 科目列表（含课代表姓名映射）
async function loadSubjects() {
  try {
    const r = await listSubjects('WEB')
    subjects.value = (r.data || r || []).map((s) => ({ ...s, repUserIds: s.repUserIds || [] }))
  } catch (e) { /* 拦截器已提示 */ }
}

// 打开设置课代表弹窗
function openRepDialog(row) {
  repTarget.value = row
  repSelected.value = [...(row.repUserIds || [])]
  repDialog.value = true
}

// 保存课代表设置
async function saveReps() {
  try {
    await setSubjectReps(repTarget.value.id, repSelected.value || [])
    ElMessage.success(`已更新「${repTarget.value.name}」课代表`)
    repDialog.value = false
    await loadSubjects()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '设置课代表失败')
    await loadSubjects()
  }
}

// 添加自定义科目（其他科目可无限添加）
async function addCustomSubject() {
  const { value } = await ElMessageBox.prompt('输入新科目名称（围绕初二学科体系，可无限添加自定义科目）', '添加科目', {
    confirmButtonText: '添加',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '科目名称不能为空',
  }).catch(() => ({ value: null }))
  if (!value) return
  const name = value.trim()
  if (subjects.value.some((s) => s.name === name)) return ElMessage.warning('该科目已存在')
  try {
    await createSubject({ name, platform: 'WEB' })
    ElMessage.success(`已添加科目「${name}」`)
    await loadSubjects()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '添加科目失败')
  }
}

// 删除科目（老师/管理员）
async function removeSubject(row) {
  try {
    await ElMessageBox.confirm(`删除科目「${row.name}」？该科目下的任务、完成记录与课代表绑定将被移除。`, '删除科目', { type: 'warning' })
  } catch (_) { return }
  try {
    await deleteSubject(row.id)
    ElMessage.success('科目已删除')
    await loadSubjects()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除科目失败')
  }
}

// 新增老师（可指定密码）
async function submitTeacher() {
  const f = teacherForm.value
  if (!f.name.trim()) return ElMessage.warning('请输入老师姓名')
  if (!f.username.trim()) return ElMessage.warning('请输入用户名')
  if (f.password && f.password.length < 8) return ElMessage.warning('密码至少 8 位')
  savingTeacher.value = true
  try {
    const r = await createUser({ username: f.username.trim(), name: f.name.trim(), role: 'TEACHER', password: f.password || undefined })
    const d = r.data ?? r
    const pwdMsg = d.password ? `，初始密码：${d.password}` : '（已使用随机临时密码）'
    ElMessageBox.alert(`老师「${f.name}」已创建${pwdMsg}\n首次登录需修改密码。`, '创建成功', { confirmButtonText: '知道了' })
    addTeacherVisible.value = false
    teacherForm.value = { name: '', username: '', password: '' }
    await loadTeachers()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建老师失败')
  } finally {
    savingTeacher.value = false
  }
}

// 新增学生（老师/管理员）
async function submitStudent() {
  const f = studentForm.value
  if (!f.name.trim()) return ElMessage.warning('请输入学生姓名')
  if (f.password && f.password.length < 6) return ElMessage.warning('密码至少 6 位')
  savingStudent.value = true
  try {
    const r = await createStudent({ name: f.name.trim(), studentNo: f.studentNo.trim(), password: f.password || undefined })
    const d = r.data ?? r
    const pwdMsg = d.password ? `，初始密码：${d.password}` : '（已使用随机临时密码）'
    ElMessageBox.alert(`学生「${f.name}」已创建${pwdMsg}\n用户名：${d.username}\n首次登录需修改密码。`, '创建成功', { confirmButtonText: '知道了' })
    addStudentVisible.value = false
    studentForm.value = { name: '', studentNo: '', password: '' }
    await loadAll()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建学生失败')
  } finally {
    savingStudent.value = false
  }
}

// 重置老师密码
async function resetTeacherPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      `将重置「${row.name}」的登录密码，留空则生成随机临时密码。`,
      '重置密码',
      { confirmButtonText: '确认重置', cancelButtonText: '取消', inputPlaceholder: '新密码（留空=随机，至少8位）' }
    )
    const res = await resetPassword(row.id, value)
    const d = res.data ?? res
    ElMessageBox.alert(`账号：${d.username}\n新密码：${d.password}`, '重置成功', { confirmButtonText: '知道了' })
  } catch (e) { /* 取消或拦截器已提示 */ }
}

// 删除老师
async function removeTeacher(row) {
  if (row.username === 'teacher01' || row.username === 'superadmin' || row.username === 'admin') {
    return ElMessage.warning('受保护账号（杨老师/系统管理员）不可删除')
  }
  try {
    await ElMessageBox.confirm(`确定删除老师「${row.name}」？该账号的关联数据将一并清除，不可恢复。`, '删除确认', { type: 'warning' })
  } catch (_) { return }
  try {
    await deleteUser(row.id)
    ElMessage.success(`已删除老师 ${row.name}`)
    await loadTeachers()
    await loadSubjects()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '删除失败')
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
    const r = await exportStudents('csv')
    ElMessage.success(`名单已导出（${r.filename}）`)
  } catch (e) { /* downloadBlobApi 已提示 */ }
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

// 单条删除（软删除，可从回收站恢复）
async function doDelete(row) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.name}」？该操作可在 30 天内从回收站恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch (_) { return }
  try {
    await request.delete(`/api/students/${row.id}`)
    ElMessage.success(`已删除 ${row.name}，如需恢复请到回收站`)
    await loadAll()
  } catch (e) { /* 拦截器已提示 */ }
}

// 批量勾选状态
function onSelectionChange(rows) {
  selected.value = rows
}

// 批量重置密码（统一密码，留空则随机）
async function batchResetPwd() {
  if (selected.value.length === 0) return
  try {
    const { value } = await ElMessageBox.prompt(
      `将对 ${selected.value.length} 名成员统一重置密码，留空则各自生成随机临时密码。`,
      '批量重置密码',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        inputPlaceholder: '统一密码（至少 6 位，留空=随机）',
        inputValidator: (v) => !v || v.length >= 6 || '密码至少 6 位'
      }
    )
  } catch (_) { return }
  ElMessage.info('正在批量重置，请稍候…')
  // 单条接口循环（前端实现简单、便于错误部分回显）
  const results = []
  for (const row of selected.value) {
    try {
      const res = await resetStudentPassword(row.id, undefined)
      const d = res.data || res
      results.push({ ok: true, name: row.name, username: d.username, password: d.password })
    } catch (e) {
      results.push({ ok: false, name: row.name, error: e.message || '失败' })
    }
  }
  const okCount = results.filter((r) => r.ok).length
  const samples = results.filter((r) => r.ok).slice(0, 5).map((r) => `${r.name}/${r.username}=${r.password}`).join('\n')
  const summary = `批量重置完成：成功 ${okCount}/${results.length}${samples ? '\n\n' + samples + (results.length > 5 ? '\n…(更多见操作日志)' : '') : ''}`
  ElMessageBox.alert(summary, '批量重置结果', { confirmButtonText: '知道了' })
  await loadAll()
}

// 批量删除（软删除，可从回收站恢复）
async function batchSoftDelete() {
  if (selected.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `将 ${selected.value.length} 名成员移入回收站，可 30 天内从「回收站」恢复。`,
      '批量删除',
      { type: 'warning', confirmButtonText: '移入回收站', cancelButtonText: '取消' }
    )
  } catch (_) { return }
  let okCount = 0
  for (const row of selected.value) {
    try {
      await request.delete(`/api/students/${row.id}`)
      okCount++
    } catch (e) { /* 单条失败跳过 */ }
  }
  ElMessage.success(`已移入回收站 ${okCount}/${selected.value.length} 人`)
  selected.value = []
  await loadAll()
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
.tabs-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; }
.section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.section-title { font-size: 15px; font-weight: 600; }
.section-sub { font-size: 12px; color: #8a94a6; }
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ml-auto { margin-left: auto; }
.tbl { width: 100%; }
.muted { color: #b0b6c0; font-size: 13px; }
.hint-box { margin-top: 12px; font-size: 12px; color: #8a94a6; background: #f7f9fc; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; line-height: 1.7; }
.hint { font-size: 13px; color: #5b6573; line-height: 1.9; }
.hint-title { font-weight: 600; margin-bottom: 4px; color: #2b3242; }
.hint code { background: #f1f3f7; padding: 1px 6px; border-radius: 5px; color: #2563eb; }
.tip-inline { font-size: 12px; color: #8a94a6; margin-top: 4px; }
.rep-tag { margin-right: 6px; }
</style>
