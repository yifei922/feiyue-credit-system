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

      <!-- 学生端：提交作业（必须上传附件） -->
      <el-tab-pane v-if="isStudent" label="提交作业" name="submit">
        <el-alert
          v-if="showResume"
          type="warning"
          :closable="false"
          show-icon
          class="resume-alert"
        >
          <template #title>检测到 {{ resumeList.length }} 个未完成的附件上传</template>
          <div class="resume-body">
            <span class="resume-files">{{ resumeList.map((p) => p.name).join('、') }}</span>
            <span class="resume-tip">上次可能因误关或断网未完成。重新进入后可继续上传（需重新选择同一文件）。</span>
            <div class="resume-actions">
              <el-button type="warning" size="small" @click="continueUploads">继续上传</el-button>
              <el-button size="small" plain @click="ignorePending">忽略</el-button>
            </div>
          </div>
        </el-alert>
        <el-card shadow="never">
          <el-form label-width="88px">
            <el-form-item label="选择任务">
              <el-select v-model="submitTaskId" placeholder="请选择要提交的作业" style="width: 320px" @change="onTaskChange">
                <el-option v-for="t in openTasks" :key="t.id" :label="`${t.title}（${t.subjectName}）`" :value="t.id" />
              </el-select>
              <span class="deadline-hint" v-if="submitTask">
                {{ isOverdue(submitTask) ? '⚠️ 已逾期，提交记为「逾期完成」' : '在截止前提交记为「按时完成」' }}
                　截止：{{ submitTask.deadline }}
              </span>
            </el-form-item>
            <el-form-item label="作业附件">
              <input ref="fileInput" type="file" multiple accept="*/*" style="display:none" @change="onPickFiles" />
              <el-button :icon="Paperclip" @click="$refs.fileInput.click()" :disabled="!submitTaskId">选择附件</el-button>
              <span class="tip">支持图片 / 视频 / Word / PDF 等任意格式；系统自动压缩体积（图片保清晰度、视频视觉无损、文档无损），画质不变。大体积视频转码较慢会实时显示进度；若误关页面，重新进入会提示是否继续上传</span>
            </el-form-item>
          </el-form>

          <div v-if="pending.length" class="att-list">
            <div v-for="(a, i) in pending" :key="i" class="att-item">
              <div class="att-prev">
                <img v-if="a.previewUrl && isImage(a)" :src="a.previewUrl" alt="预览" />
                <video v-else-if="a.previewUrl && isVideo(a)" :src="a.previewUrl" controls></video>
                <el-icon v-else class="att-file-ico"><Document /></el-icon>
              </div>
              <div class="att-info">
                <div class="att-name">{{ a.name }}</div>
                <div class="att-size">
                  {{ formatSize(a.originalSize) }}
                  <template v-if="a.compressedSize != null">
                    → <b :class="a.compressedSize < a.originalSize ? 'shrunk' : ''">{{ formatSize(a.compressedSize) }}</b>
                    <span class="rate" v-if="a.compressedSize < a.originalSize">(压缩 {{ shrinkRate(a.originalSize, a.compressedSize) }})</span>
                  </template>
                </div>
                <div class="att-progress" v-if="a.phase==='uploading' || a.phase==='processing'">
                  <el-progress
                    :percentage="a.phase==='uploading' ? a.progress : (a.indeterminate ? 100 : a.progress)"
                    :indeterminate="a.phase==='processing' && a.indeterminate"
                    :stroke-width="8" />
                  <span class="att-stage">
                    <template v-if="a.phase==='uploading'">上传中 {{ a.progress }}%</template>
                    <template v-else>{{ a.stageText || '处理中…' }}<template v-if="!a.indeterminate && a.progress"> {{ a.progress }}%</template></template>
                  </span>
                </div>
                <el-tag v-else-if="a.phase==='done'" type="success" size="small" effect="plain">已上传</el-tag>
                <el-tag v-else-if="a.phase==='error'" type="danger" size="small" effect="plain">失败</el-tag>
              </div>
              <el-button link type="danger" size="small" @click="removePending(i)">移除</el-button>
            </div>
          </div>

          <div class="submit-bar">
            <el-button type="primary" :disabled="!submitTaskId || uploadedCount===0 || submitting" @click="submitHomework">
              提交作业（已上传 {{ uploadedCount }} 个附件）
            </el-button>
            <span class="req">* 提交作业必须附带至少 1 个附件</span>
          </div>
        </el-card>

        <el-card shadow="never" class="my-submit">
          <div class="panel-title">我的提交记录</div>
          <el-empty v-if="!mySubs.length" description="暂无提交记录" :image-size="80" />
          <div v-for="(rec, i) in mySubs" :key="i" class="sub-item">
            <div class="sub-head">
              <b>{{ rec.taskTitle }}</b>
              <el-tag size="small" :type="statusTag(rec.status)">{{ statusText[rec.status] || rec.status }}</el-tag>
              <span class="sub-time">{{ rec.completionTime || '未标记时间' }}</span>
            </div>
            <div v-if="rec.attachments && rec.attachments.length" class="sub-atts">
              <a v-for="att in rec.attachments" :key="att.id" class="sub-att" :href="att.dispUrl || ('/api/uploads/'+att.storedName)" target="_blank" rel="noopener">
                <img v-if="att.dispUrl && isImage(att)" :src="att.dispUrl" class="sub-thumb" />
                <video v-else-if="att.dispUrl && isVideo(att)" :src="att.dispUrl" class="sub-thumb" controls></video>
                <el-icon v-else class="sub-file-ico"><Document /></el-icon>
                <span class="sub-att-name">{{ att.originalName }}</span>
              </a>
            </div>
            <div v-else class="sub-noatt">（无附件）</div>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Bell, Paperclip, Document } from '@element-plus/icons-vue'
import { listStudents } from '@/api/student'
import { listCreditFlow } from '@/api/creditFlow'
import { recommendTasks } from '@/api/recommend'
import { exportCompletions, listCompletions, registerCompletion } from '@/api/completion'
import { listTasks } from '@/api/task'
import { uploadFile, uploadFileWithProgress, deleteAttachment, getPendingUploads, addPendingUpload, removePendingUpload, clearPendingUploads } from '@/api/upload'
import { listAlerts, resolveAlert } from '@/api/alert'
import { fetchAttachmentUrl } from '@/api/upload'
import { downloadBlob } from '@/utils/download'
import { compressImage, formatSize } from '@/utils/compress'
import { flowTypeText, statusText } from '@/api/mock'
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

// ── 提交作业相关 ──
const allTasks = ref([])
const submitTaskId = ref(null)
const pending = ref([])
const submitting = ref(false)
const mySubs = ref([])
const fileInput = ref(null)
const objectUrls = [] // 需要手动释放的 object URL

// ── 意外关闭后的「未完成上传」提示 ──
const resumeList = ref([])
const showResume = ref(false)
function scanPendingUploads() {
  // 清掉 24 小时前的陈旧记录，避免反复打扰
  const now = Date.now()
  const fresh = getPendingUploads().filter((p) => now - (p.ts || 0) < 24 * 3600 * 1000)
  const mine = fresh.filter((p) => p.studentId === auth.user?.studentId)
  clearPendingUploads()
  if (mine.length) { resumeList.value = mine; showResume.value = true }
  else showResume.value = false
}
function continueUploads() {
  // 用户确认继续：清空陈旧标记并打开文件选择，由用户重新选择同一文件后上传
  clearPendingUploads()
  showResume.value = false
  if (fileInput.value) fileInput.value.click()
}
function ignorePending() {
  clearPendingUploads()
  showResume.value = false
}

const openTasks = computed(() => allTasks.value.filter((t) => t.status === 'OPEN'))
const submitTask = computed(() => allTasks.value.find((t) => t.id === submitTaskId.value) || null)
const uploadedCount = computed(() => pending.value.filter((a) => a.phase === 'done').length)

function isImage(a) { return (a.mime || '').startsWith('image/') }
function isVideo(a) { return (a.mime || '').startsWith('video/') }
function shrinkRate(o, c) { return o ? Math.round((1 - c / o) * 100) + '%' : '0%' }
function statusTag(s) {
  return s === 'DONE_ONTIME' ? 'success' : s === 'DONE_OVERDUE' ? 'warning' : s === 'UNFINISHED' ? 'info' : 'danger'
}
function isOverdue(task) {
  if (!task?.deadline) return false
  const t = new Date(String(task.deadline).replace(/-/g, '/')).getTime()
  return t < Date.now()
}

function onTaskChange() {
  // 切换任务时清空已选附件（附件与任务绑定）
  pending.value.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
  pending.value = []
}

async function onPickFiles(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = '' // 允许重复选择同一文件
  if (!files.length) return
  for (const file of files) {
    const item = {
      name: file.name,
      mime: file.type,
      originalSize: file.size,
      compressedSize: null,
      phase: 'uploading',
      progress: 0,
      stageText: '上传中…',
      indeterminate: false,
      previewUrl: null,
      id: null,
      pendingId: 'pu_' + Date.now() + '_' + Math.random().toString(16).slice(2)
    }
    // 记录到本地「未完成上传」清单，意外关闭后可提示续传
    addPendingUpload({ id: item.pendingId, name: file.name, size: file.size, type: file.type, taskId: submitTaskId.value, studentId: auth.user?.studentId, ts: Date.now() })
    // 浏览器端先压缩（图片）：生成预览并减小实际上传体积
    const { blob, compressed } = await compressImage(file)
    item.previewUrl = URL.createObjectURL(blob)
    objectUrls.push(item.previewUrl)
    pending.value.push(item)
    try {
      const r = await uploadFileWithProgress(blob, submitTaskId.value, {
        onUpload: (p) => { item.phase = 'uploading'; item.progress = p },
        onProcess: (p, msg, ind) => {
          item.phase = 'processing'
          item.stageText = msg || '处理中…'
          item.indeterminate = !!ind
          if (p != null) item.progress = p
        }
      })
      const data = r.data ?? r
      item.phase = 'done'
      item.progress = 100
      item.id = data.id
      item.compressedSize = data.sizeCompressed
      // 服务端可能再次压缩，以返回值为准
      if (!compressed && data.compressed) item.compressedSize = data.sizeCompressed
      removePendingUpload(item.pendingId) // 上传成功 → 从未完成清单移除
    } catch (err) {
      item.phase = 'error'
      ElMessage.error(`附件「${file.name}」上传失败`)
    }
  }
}

function removePending(i) {
  const a = pending.value[i]
  if (a.previewUrl) { URL.revokeObjectURL(a.previewUrl); const idx = objectUrls.indexOf(a.previewUrl); if (idx >= 0) objectUrls.splice(idx, 1) }
  if (a.id) deleteAttachment(a.id).catch(() => {})
  if (a.pendingId) removePendingUpload(a.pendingId)
  pending.value.splice(i, 1)
}

async function submitHomework() {
  if (!submitTaskId.value) return ElMessage.warning('请先选择任务')
  if (uploadedCount.value === 0) return ElMessage.warning('请至少上传 1 个附件')
  submitting.value = true
  try {
    const status = isOverdue(submitTask.value) ? 'DONE_OVERDUE' : 'DONE_ONTIME'
    const r = await registerCompletion({ taskId: submitTaskId.value, status })
    const res = r.data ?? r
    ElMessage.success(`提交成功，本次获得学分 ${res.gained ?? 0}`)
    pending.value.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    pending.value = []
    await loadMySubs()
  } catch (e) {
    // 错误由拦截器统一提示
  } finally {
    submitting.value = false
  }
}

async function loadMySubs() {
  const r = await listCompletions({ studentId: studentId.value })
  const list = r.data ?? r
  mySubs.value = (list || []).map((rec) => ({
    ...rec,
    attachments: (rec.attachments || []).map((a) => ({ ...a, dispUrl: null }))
  }))
  // 为图片/视频附件获取带鉴权的可显示地址
  for (const rec of mySubs.value) {
    for (const att of rec.attachments) {
      if (isImage(att) || isVideo(att)) {
        try {
          const url = await fetchAttachmentUrl(att.storedName)
          att.dispUrl = url
          objectUrls.push(url)
        } catch (_) {}
      }
    }
  }
}

// ── 通用加载 ──
async function loadAll() {
  await loadFlow()
  await loadRec()
  await loadNotices()
  if (isStudent.value) await loadMySubs()
}
async function loadNotices() {
  const r = await listAlerts()
  const list = r.data ?? r
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

async function exportMine() {
  try {
    const blob = await exportCompletions('csv', { studentId: studentId.value })
    const d = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `我的成绩单_${d}.csv`)
    ElMessage.success('成绩单已导出')
  } catch (e) { }
}

onMounted(async () => {
  const s = await listStudents()
  students.value = s.data ?? s
  if (students.value.length) {
    studentId.value = isStudent.value ? (auth.user?.studentId ?? students.value[0].id) : students.value[0].id
    const t = await listTasks()
    allTasks.value = t.data ?? t
    await loadAll()
  }
  scanPendingUploads() // 进入页面即检查是否有上次未完成的附件上传
})
onBeforeUnmount(() => {
  objectUrls.forEach((u) => URL.revokeObjectURL(u))
  window.removeEventListener('app:save', onSubmit)
  window.removeEventListener('app:select-all', onSelectAll)
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
.deadline-hint { font-size: 12px; color: var(--text-soft); margin-left: 10px; }
.tip { font-size: 12px; color: var(--text-soft); margin-left: 10px; }
.att-list { margin: 8px 0 4px; display: flex; flex-direction: column; gap: 10px; }
.resume-alert { margin-bottom: 14px; }
.resume-body { font-size: 13px; line-height: 1.7; }
.resume-files { font-weight: 600; color: #b45309; word-break: break-all; }
.resume-tip { color: var(--text-soft); margin-left: 6px; }
.resume-actions { margin-top: 8px; display: flex; gap: 10px; }
.att-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
.att-prev { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #f3f4f6; display: flex; align-items: center; justify-content: center; flex: none; }
.att-prev img, .att-prev video { width: 100%; height: 100%; object-fit: cover; }
.att-file-ico { font-size: 28px; color: #9aa5b1; }
.att-info { flex: 1; min-width: 0; }
.att-progress { margin: 2px 0 4px; display: flex; align-items: center; gap: 10px; }
.att-progress .el-progress { flex: 1; max-width: 220px; }
.att-stage { font-size: 12px; color: var(--text-soft); white-space: nowrap; }
.att-name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.att-size { font-size: 12px; color: var(--text-soft); margin: 2px 0 4px; }
.att-size .shrunk { color: #16a34a; }
.rate { color: #16a34a; margin-left: 4px; }
.submit-bar { margin-top: 12px; display: flex; align-items: center; gap: 12px; }
.req { font-size: 12px; color: #ef4444; }
.my-submit { margin-top: 16px; }
.panel-title { font-weight: 600; margin-bottom: 10px; }
.sub-item { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
.sub-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sub-time { font-size: 12px; color: var(--text-soft); margin-left: auto; }
.sub-atts { display: flex; flex-wrap: wrap; gap: 10px; }
.sub-att { display: flex; align-items: center; gap: 6px; text-decoration: none; color: #2b3242; border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
.sub-thumb { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; }
.sub-file-ico { font-size: 22px; color: #9aa5b1; }
.sub-att-name { font-size: 12px; max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub-noatt { font-size: 12px; color: var(--text-soft); }
</style>
