<template>
  <div class="settings">
    <el-tabs v-model="activeTab" class="tabs-card">
      <!-- 课代表任命（管理员/老师） -->
      <el-tab-pane v-if="canManage" label="课代表任命" name="reps">
        <el-card shadow="never">
          <template #header>
            <span class="h">课代表任命</span>
            <span class="sub">为每个科目指定课代表；课代表可管理所负责科目的任务、成绩、提醒</span>
          </template>
          <el-table :data="subjects" stripe border max-height="520">
            <el-table-column prop="name" label="科目" width="140" />
            <el-table-column label="当前课代表" min-width="220">
              <template #default="{ row }">
                <template v-if="row.repNames && row.repNames.length">
                  <el-tag v-for="(n, i) in row.repNames" :key="i" class="rep-tag" type="primary" effect="light">{{ n }}</el-tag>
                </template>
                <span v-else class="muted">未设置</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openRepDialog(row)">设置课代表</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="tip">
            提示：候选课代表来自「账号管理」中角色为<b>课代表</b>的账号。如需新增，请到「账号管理」把某个学生账号的角色改为课代表。
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 账号管理（管理员/老师） -->
      <el-tab-pane v-if="canManage" label="账号管理" name="accounts">
        <el-card shadow="never">
          <template #header>
            <span class="h">账号管理</span>
            <span class="sub">重置任意账号密码；将账号设为课代表 / 学生并绑定科目</span>
          </template>
          <el-form inline class="filters">
            <el-form-item label="角色筛选">
              <el-select v-model="roleFilter" clearable placeholder="全部" style="width: 150px" @change="loadUsers">
                <el-option label="管理员" value="ADMIN" />
                <el-option label="老师" value="TEACHER" />
                <el-option label="课代表" value="REP" />
                <el-option label="学生" value="STUDENT" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="loadUsers">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="users" stripe border max-height="480">
            <el-table-column prop="username" label="登录账号" width="140" />
            <el-table-column prop="name" label="姓名" width="130" />
            <el-table-column label="角色" width="100">
              <template #default="{ row }">
                <el-tag :type="roleTag(row.role)" effect="light">{{ row.roleLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="负责科目" min-width="180">
              <template #default="{ row }">
                <span v-if="row.subjectNames.length">{{ row.subjectNames.join('、') }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="warning" @click="resetPwd(row)">重置密码</el-button>
                <el-button link type="primary" :disabled="row.username === 'superadmin'" @click="openRoleDialog(row)">修改角色</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 操作日志 -->
      <el-tab-pane label="操作日志" name="logs">
        <el-card shadow="never">
          <template #header>
            <span class="h">操作日志查询</span>
          </template>
          <el-form inline class="filters">
            <el-form-item label="操作人">
              <el-input v-model="q.operatorName" placeholder="姓名模糊" clearable style="width: 150px" />
            </el-form-item>
            <el-form-item label="操作类型">
              <el-select v-model="q.operateType" placeholder="全部" clearable style="width: 150px">
                <el-option label="新增 INSERT" value="INSERT" />
                <el-option label="修改 UPDATE" value="UPDATE" />
                <el-option label="删除 DELETE" value="DELETE" />
              </el-select>
            </el-form-item>
            <el-form-item label="时间">
              <el-date-picker v-model="range" type="datetimerange" range-separator="~" start-placeholder="开始" end-placeholder="结束" style="width: 320px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="load">查询</el-button>
              <el-button @click="reset">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="logs" stripe max-height="460">
            <el-table-column prop="operatorName" label="操作人" width="120" />
            <el-table-column prop="operateType" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.operateType === 'INSERT' ? 'success' : row.operateType === 'DELETE' ? 'danger' : 'warning'">{{ row.operateType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="tableName" label="数据表" width="160" />
            <el-table-column prop="recordId" label="记录ID" width="90" />
            <el-table-column prop="createTime" label="时间" width="180" />
            <el-table-column label="操作" fixed="right" width="90">
              <template #default="{ row }">
                <el-button link type="primary" @click="showDetail(row)">快照</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 设置课代表弹窗 -->
    <el-dialog v-model="repDialog" :title="`设置「${repTarget.name}」课代表`" width="420px">
      <el-select v-model="repSelected" multiple filterable placeholder="选择课代表账号" style="width: 100%">
        <el-option v-for="u in repCandidates" :key="u.id" :label="`${u.name}（${u.username}）`" :value="u.id" />
      </el-select>
      <div class="tip" v-if="!repCandidates.length">暂无课代表账号，请先到「账号管理」将某账号角色设为课代表。</div>
      <template #footer>
        <el-button @click="repDialog = false">取消</el-button>
        <el-button type="primary" @click="saveReps">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改角色弹窗 -->
    <el-dialog v-model="roleDialog" :title="`修改「${roleTarget.name}」角色`" width="440px">
      <el-form label-width="90px">
        <el-form-item label="角色">
          <el-select v-model="roleForm.role" style="width: 100%">
            <el-option label="学生" value="STUDENT" />
            <el-option label="课代表" value="REP" />
            <el-option label="老师" value="TEACHER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="roleForm.role === 'REP'" label="负责科目">
          <el-select v-model="roleForm.subjectIds" multiple filterable placeholder="选择负责科目" style="width: 100%">
            <el-option v-for="s in subjects" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>

    <!-- 日志快照 -->
    <el-dialog v-model="detailVisible" title="数据快照（修改前后）" width="640px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="修改前">
          <pre class="snap">{{ current.beforeSnapshot || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="修改后">
          <pre class="snap after">{{ current.afterSnapshot || '—' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listOperateLogs } from '@/api/operateLog'
import { listSubjects, setSubjectReps } from '@/api/subject'
import { listUsers, resetPassword, setUserRole } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canManage = computed(() => ['ADMIN', 'TEACHER'].includes(auth.user?.role))
const activeTab = ref(canManage.value ? 'reps' : 'logs')

// ---- 操作日志 ----
const q = ref({ operatorName: '', operateType: '', startTime: '', endTime: '' })
const range = ref(null)
const logs = ref([])
const detailVisible = ref(false)
const current = ref({})

async function load() {
  if (range.value) {
    q.value.startTime = fmt(range.value[0])
    q.value.endTime = fmt(range.value[1])
  } else {
    q.value.startTime = ''
    q.value.endTime = ''
  }
  const r = await listOperateLogs(q.value)
  const data = r.data ?? r
  logs.value = data.records ?? data
}
function reset() {
  q.value = { operatorName: '', operateType: '', startTime: '', endTime: '' }
  range.value = null
  load()
}
function showDetail(row) { current.value = row; detailVisible.value = true }
function fmt(d) {
  if (!d) return ''
  const dt = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`
}

// ---- 科目 / 课代表 ----
const subjects = ref([])
const users = ref([])
const roleFilter = ref('')
const repCandidates = computed(() => users.value.filter((u) => u.role === 'REP'))

async function loadSubjects() {
  const r = await listSubjects()
  subjects.value = r.data ?? r
}
async function loadUsers() {
  const r = await listUsers(roleFilter.value)
  users.value = r.data ?? r
}

const repDialog = ref(false)
const repTarget = ref({})
const repSelected = ref([])
function openRepDialog(row) {
  repTarget.value = row
  repSelected.value = [...(row.repUserIds || [])]
  repDialog.value = true
}
async function saveReps() {
  await setSubjectReps(repTarget.value.id, repSelected.value)
  ElMessage.success('课代表已更新')
  repDialog.value = false
  await Promise.all([loadSubjects(), loadUsers()])
}

// ---- 角色修改 ----
const roleDialog = ref(false)
const roleTarget = ref({})
const roleForm = ref({ role: 'STUDENT', subjectIds: [] })
function openRoleDialog(row) {
  roleTarget.value = row
  roleForm.value = { role: row.role, subjectIds: [...(row.subjectIds || [])] }
  roleDialog.value = true
}
async function saveRole() {
  await setUserRole(roleTarget.value.id, roleForm.value.role, roleForm.value.subjectIds)
  ElMessage.success('角色已更新')
  roleDialog.value = false
  await Promise.all([loadSubjects(), loadUsers()])
}

// ---- 重置密码 ----
async function resetPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      `将重置「${row.name}」(${row.username}) 的密码。留空则重置为默认 123456。`,
      '重置密码',
      { confirmButtonText: '确认重置', cancelButtonText: '取消', inputPlaceholder: '新密码（留空=123456）' }
    )
    const res = await resetPassword(row.id, value)
    const d = res.data ?? res
    ElMessageBox.alert(`账号：${d.username}\n新密码：${d.password}`, '重置成功', { confirmButtonText: '知道了' })
  } catch (e) { /* 取消 */ }
}

function roleTag(role) {
  return { ADMIN: 'danger', TEACHER: 'warning', REP: 'primary', STUDENT: 'info' }[role] || 'info'
}

onMounted(() => {
  load()
  if (canManage.value) {
    loadSubjects()
    loadUsers()
  }
})
</script>

<style scoped>
.h { font-weight: 600; margin-right: 10px; }
.sub { font-size: 12px; color: #8a94a6; }
.filters { margin-bottom: 12px; }
.snap { background: #f5f7fa; padding: 10px; border-radius: 6px; font-size: 12px; white-space: pre-wrap; word-break: break-all; margin: 0; }
.snap.after { background: #f0f9eb; }
.rep-tag { margin-right: 6px; }
.muted { color: #b0b6c0; }
.tip { margin-top: 12px; font-size: 12px; color: #8a94a6; line-height: 1.7; }
</style>
