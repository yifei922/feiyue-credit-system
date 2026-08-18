<template>
  <div class="hall-page">
    <!-- 撒花层（获得徽章时庆祝） -->
    <div class="confetti-layer" ref="confettiLayer"></div>

    <!-- ── 英雄区（Hero Banner）── -->
    <div class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <div class="hero-icon">
          <el-icon :size="32"><Trophy /></el-icon>
        </div>
        <div class="hero-text">
          <h1>荣誉殿堂</h1>
          <p v-if="isTeacherOrAdmin">激励每一份坚持，见证每一次成长</p>
          <p v-else>每一枚徽章，都是成长的见证</p>
        </div>
        <div class="hero-stats">
          <div class="stat">
            <b>{{ isTeacherOrAdmin && overview ? (overview.students?.length || 0) : earnedCountForStats }}</b>
            <span>{{ isTeacherOrAdmin && overview ? '班级人数' : '已获得' }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <b>{{ isTeacherOrAdmin && overview ? classAvgBadges : totalCount }}</b>
            <span>{{ isTeacherOrAdmin && overview ? '人均徽章' : '总徽章' }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <b>{{ isTeacherOrAdmin && overview ? classEarnedRate + '%' : (progress?.percent ?? progressPercent) + '%' }}</b>
            <span>{{ isTeacherOrAdmin && overview ? '班级收集度' : '我的收集度' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 教师/管理员：管理职权栏 ── -->
    <div class="teacher-bar" v-if="isTeacherOrAdmin">
      <el-button :type="showMatrix ? 'primary' : 'default'" @click="toggleMatrix" :icon="Grid">
        班级徽章矩阵
      </el-button>
      <el-button type="primary" @click="openBatch" :icon="Promotion">批量颁发</el-button>
      <el-button v-if="isAdmin" @click="showLibrary = true" :icon="Collection">徽章库管理</el-button>
      <el-button @click="openLogs" :icon="Document">授予记录</el-button>
    </div>

    <!-- ── 学生可玩性：进度卡片 ── -->
    <div class="progress-card card" v-if="!isTeacherOrAdmin && progress">
      <div class="pc-head">
        <span class="pc-title">我的收集进度</span>
        <span class="pc-percent">{{ progress.percent }}%</span>
      </div>
      <div class="pc-bar">
        <div class="pc-fill" :style="{ width: progress.percent + '%' }"></div>
      </div>
      <div class="pc-meta">
        <span><el-icon><Medal /></el-icon> {{ progress.earnedCount }}/{{ progress.total }} 枚</span>
        <span><el-icon><Coin /></el-icon> {{ progress.points }} 积分</span>
        <span v-if="progress.next" class="pc-next">下一枚：{{ progress.next.name }}</span>
      </div>
      <div class="pc-hint" v-if="progress.next && progress.next.threshold > 0">
        解锁提示：{{ thresholdTextLocal(progress.next) }}
      </div>
    </div>

    <!-- ── 连续打卡热力图 ── -->
    <div class="card" v-if="!isTeacherOrAdmin && progress">
      <div class="section-title"><span>连续打卡热力图</span></div>
      <StreakHeatmap :data="heatmapData" :streak="progress.streak" />
    </div>

    <!-- ── 班级徽章矩阵（教师/管理员）── -->
    <div class="matrix card" v-if="isTeacherOrAdmin && showMatrix && overview">
      <div class="section-title">
        <span>班级徽章矩阵（学生 × 徽章）</span>
        <span class="count-hint">点击 ✓ 可撤销 · 点击 空 快速授予</span>
      </div>
      <div class="matrix-scroll">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="m-stu">学生</th>
              <th v-for="b in overview.badges" :key="b.id" :title="b.name">
                <el-icon :size="16"><component :is="iconMap[b.icon] || Trophy" /></el-icon>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stu in overview.students" :key="stu.id">
              <td class="m-stu stu-clickable" @click="openStudentManage(stu)">
                {{ stu.name }}<small v-if="stu.studentNo"> · {{ stu.studentNo }}</small>
                <span class="stu-manage-hint">管理</span>
              </td>
              <td v-for="b in overview.badges" :key="b.id">
                <span
                  class="m-cell"
                  :class="hasBadge(stu.id, b.id) ? 'on' : 'off'"
                  @click="onMatrixCell(stu, b)"
                >{{ hasBadge(stu.id, b.id) ? '✓' : '' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── 九宫格徽章墙 ── -->
    <div class="grid-section">
      <div class="section-title">
        <span>徽章墙</span>
        <span class="count-hint">{{ earnedCountForStats }}/{{ totalCount }}</span>
      </div>

      <div class="loading" v-if="loading">
        <div class="sk-row" v-for="n in 6" :key="n">
          <SkeletonBlock :width="52" :height="52" radius="14" />
          <div class="sk-text">
            <SkeletonBlock :width="80" :height="12" />
            <SkeletonBlock :width="120" :height="10" />
          </div>
        </div>
      </div>

      <div class="empty card" v-else-if="totalCount === 0">
        <el-icon :size="48" color="#c0bfc0"><Trophy /></el-icon>
        <p>暂无徽章数据</p>
        <p class="sub">管理员可在「徽章库管理」配置徽章</p>
      </div>

      <div class="badge-grid" v-else>
        <div
          v-for="b in allBadges"
          :key="b.code"
          class="badge-card"
          :class="{ earned: earnedSet.has(b.code), locked: !earnedSet.has(b.code) }"
          @click="onBadgeClick(b)"
        >
          <div class="card-inner">
            <div class="badge-icon-wrap">
              <img
                :src="badgeImage(b.code)"
                :alt="b.name"
                class="badge-img"
                :class="{ locked: !earnedSet.has(b.code) }"
                loading="lazy"
                @error="$event.target.src = '/badges/default.svg'"
              />
              <div class="lock-overlay" v-if="!earnedSet.has(b.code)">
                <el-icon :size="18"><Lock /></el-icon>
              </div>
              <div class="check-badge" v-if="earnedSet.has(b.code)">
                <el-icon :size="12"><Check /></el-icon>
              </div>
            </div>
            <div class="badge-name">{{ b.name }}</div>
            <div class="badge-desc">{{ b.description }}</div>
            <div class="badge-status" v-if="earnedSet.has(b.code)">
              <span class="earned-date">{{ formatDate(earnedMap[b.code]?.earnedAt) }} 获得</span>
            </div>
            <div class="badge-status" v-else>
              <el-tag size="small" type="info" effect="plain">
                {{ isTeacherOrAdmin ? '未授予' : '未解锁' }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 最近获得 ── -->
    <div class="recent-section card" v-if="recentEarned.length > 0">
      <div class="section-title">最近获得</div>
      <div class="recent-list">
        <div class="recent-item" v-for="item in recentEarned" :key="item.code + item.earnedAt">
          <img
            :src="badgeImage(item.code)"
            class="recent-img"
            :alt="item.name"
            @error="$event.target.src = '/badges/default.svg'"
          />
          <div class="recent-info">
            <b>{{ item.name }}</b>
            <span>{{ formatDate(item.earnedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 教师单发弹窗（从矩阵空单元格快速授予）── -->
    <el-dialog v-model="showGrantDialog" title="颁发徽章" width="420px" class="mobile-fit" :close-on-click-modal="false">
      <el-form :model="grantForm" label-width="80px">
        <el-form-item label="学生">
          <el-input :model-value="grantForm.stuName" disabled />
        </el-form-item>
        <el-form-item label="选择徽章">
          <div class="grant-badge-grid">
            <div
              v-for="b in allBadges"
              :key="b.code"
              class="grant-option"
              :class="{ selected: grantForm.code === b.code }"
              @click="grantForm.code = b.code"
            >
              <el-icon :size="20"><component :is="iconMap[b.icon] || Trophy" /></el-icon>
              <span>{{ b.name }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGrantDialog = false">取消</el-button>
        <el-button type="primary" :loading="granting" @click="doGrant" :disabled="!grantForm.code">
          确认颁发
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 批量颁发弹窗 ── -->
    <el-dialog v-model="showBatch" title="批量颁发徽章" width="520px" class="mobile-fit" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="选择学生">
          <el-select v-model="batchForm.userIds" multiple filterable placeholder="搜索并选择学生" style="width: 100%">
            <el-option v-for="s in studentList" :key="s.id" :label="`${s.name} (${s.studentNo || s.username})`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择徽章">
          <div class="grant-badge-grid">
            <div
              v-for="b in allBadges"
              :key="b.code"
              class="grant-option"
              :class="{ selected: batchForm.code === b.code }"
              @click="batchForm.code = b.code"
            >
              <el-icon :size="20"><component :is="iconMap[b.icon] || Trophy" /></el-icon>
              <span>{{ b.name }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatch = false">取消</el-button>
        <el-button type="primary" :loading="batchGranting" @click="doBatchGrant"
          :disabled="!batchForm.userIds.length || !batchForm.code">
          颁发给 {{ batchForm.userIds.length }} 人
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 徽章库管理弹窗 ── -->
    <el-dialog v-model="showLibrary" title="徽章库管理" width="640px" class="mobile-fit" :close-on-click-modal="false">
      <div class="lib-toolbar">
        <el-button type="primary" :icon="Plus" @click="openLibCreate">新增徽章</el-button>
      </div>
      <el-table :data="allBadges" size="small" style="width: 100%">
        <el-table-column label="图标" width="60">
          <template #default="{ row }">
            <el-icon :size="18"><component :is="iconMap[row.icon] || Trophy" /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="category" label="类别" width="110">
          <template #default="{ row }"><el-tag size="small">{{ categoryLabel(row.category) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="openLibEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="showLibForm" :title="libForm.id ? '编辑徽章' : '新增徽章'" width="420px" class="mobile-fit" append-to-body>
        <el-form :model="libForm" label-width="80px">
          <el-form-item label="code"><el-input v-model="libForm.code" :disabled="!!libForm.id" placeholder="唯一标识，如 first-task" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="libForm.name" placeholder="如 初心徽章" /></el-form-item>
          <el-form-item label="描述"><el-input v-model="libForm.description" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="图标">
            <el-select v-model="libForm.icon" placeholder="选择图标" style="width: 100%">
              <el-option v-for="ic in iconOptions" :key="ic" :label="ic" :value="ic" />
            </el-select>
          </el-form-item>
          <el-form-item label="类别">
            <el-select v-model="libForm.category" style="width: 100%">
              <el-option v-for="(v, k) in categoryMap" :key="k" :label="v" :value="k" />
            </el-select>
          </el-form-item>
          <el-form-item label="阈值"><el-input-number v-model="libForm.threshold" :min="0" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="libForm.sort_order" :min="0" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showLibForm = false">取消</el-button>
          <el-button type="primary" :loading="libSaving" @click="saveLib">保存</el-button>
        </template>
      </el-dialog>
    </el-dialog>

    <!-- ── 授予记录弹窗 ── -->
    <el-dialog v-model="showLogs" title="授予记录" width="520px" class="mobile-fit">
      <el-timeline v-if="grantLogs.length">
        <el-timeline-item
          v-for="log in grantLogs"
          :key="log.id"
          :timestamp="formatDate(log.create_time)"
          :type="log.operate_type === 'badge_revoke' ? 'danger' : 'primary'"
        >
          <b>{{ log.operator_name || '管理员' }}</b>
          {{ log.operate_type === 'badge_grant' ? '颁发徽章' : log.operate_type === 'badge_grant_batch' ? '批量颁发徽章' : '撤销徽章' }}
          <div class="log-detail" v-if="logDetail(log)">{{ logDetail(log) }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无授予记录" />
    </el-dialog>

    <!-- ── 徽章详情弹窗 ── -->
    <el-dialog v-model="showDetailDialog" :title="detailBadge?.name" width="380px" class="mobile-fit">
      <div class="detail-body" v-if="detailBadge">
        <img :src="badgeImage(detailBadge.code)" class="detail-img" :alt="detailBadge.name" @error="$event.target.src = '/badges/default.svg'" />
        <p class="detail-quote" v-if="BADGE_QUOTES[detailBadge.code]">
          “{{ BADGE_QUOTES[detailBadge.code] }}”
        </p>
        <p class="detail-desc">{{ detailBadge.description }}</p>
        <div class="detail-meta">
          <div class="meta-row">
            <span class="meta-label">类别</span>
            <el-tag size="small">{{ categoryLabel(detailBadge.category) }}</el-tag>
          </div>
          <div class="meta-row" v-if="detailBadge.threshold > 0">
            <span class="meta-label">解锁条件</span>
            <span>{{ thresholdTextLocal(detailBadge) }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">状态</span>
            <el-tag :type="earnedSet.has(detailBadge?.code) ? 'success' : 'info'" size="small">
              {{ earnedSet.has(detailBadge?.code) ? '已获得' : (isTeacherOrAdmin ? '未授予' : '未解锁') }}
            </el-tag>
          </div>
          <div class="meta-row" v-if="earnedSet.has(detailBadge?.code)">
            <span class="meta-label">获得时间</span>
            <span>{{ formatDate(earnedMap[detailBadge?.code]?.earnedAt) }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ── 学生徽章快捷管理（点学生姓名进入，即时授予/撤销）── -->
    <el-dialog v-model="showStudentDialog" :title="`${studentMgr?.name || ''} 的徽章`" width="520px" class="mobile-fit" :close-on-click-modal="false">
      <p class="stu-mgr-tip">点击徽章即可即时授予 / 撤销，无需逐个确认</p>
      <div class="stu-mgr-grid">
        <div
          v-for="b in allBadges"
          :key="b.code"
          class="stu-mgr-chip"
          :class="{ on: studentMgrIds.includes(b.id) }"
          @click="toggleStudentBadge(b)"
        >
          <el-icon :size="20"><component :is="iconMap[b.icon] || Trophy" /></el-icon>
          <span>{{ b.name }}</span>
          <span class="stu-mgr-check" v-if="studentMgrIds.includes(b.id)"><el-icon :size="12"><Check /></el-icon></span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Trophy, Lock, Check, Medal, Sunny, Service, Connection, Plus, Edit,
  Delete, Grid, Document, Promotion, Collection, Coin, Calendar, Star, User,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgeStore } from '@/stores/useBadge'
import { listUsers } from '@/api/user'
import StreakHeatmap from '@/components/StreakHeatmap.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const auth = useAuthStore()
const badgeStore = useBadgeStore()

const loading = ref(true)
const confettiLayer = ref(null)

// 图标映射：徽章库存储的 icon 字符串 → 真实组件（Reading/Hands/Crown/Prize/Flame 非 EP 内置，用近义图标替代）
const iconMap = {
  Trophy, Medal, Star, Sunny, Calendar, User, Coin,
  Service, Connection, Lock, Check, Plus, Edit, Delete, Grid, Document, Promotion, Collection,
  Reading: Service, Hands: Connection, Crown: Medal, Prize: Medal, Flame: Sunny,
}

const categoryMap = {
  MILESTONE: '里程碑', STREAK: '连续打卡', QUALITY: '完美表现',
  CREDIT: '积分成就', HABIT: '好习惯', SUBJECT: '学科', SOCIAL: '社交', SPECIAL: '特殊荣誉',
}
const iconOptions = ['Trophy', 'Medal', 'Star', 'Sunny', 'Calendar', 'User', 'Coin', 'Service', 'Connection', 'Lock', 'Check', 'Plus', 'Edit', 'Delete', 'Grid', 'Document', 'Promotion', 'Collection']

// 徽章插画与激励语（与 public/badges/<code>.svg 一一对应）
const BADGE_QUOTES = {
  first_login: '每一次开始，都是成长的起点。',
  week_streak: '坚持七天，遇见更好的自己。',
  month_streak: '三十天不间断，习惯成自然。',
  perfect_week: '一周全力以赴，不负每一刻。',
  top_credits: '积分记录努力，努力成就光芒。',
  early_bird: '晨光不负早起人。',
  bookworm: '每一页，都是通往世界的窗。',
  helper: '帮助别人，也是温暖自己。',
  all_rounder: '全面发展，样样精彩。',
}
function badgeImage(code) { return `/badges/${code}.svg` }

const isTeacherOrAdmin = computed(() => ['ADMIN', 'TEACHER'].includes(auth.user?.role))
const isAdmin = computed(() => auth.user?.role === 'ADMIN')

// store 派生
const allBadges = computed(() => badgeStore.allBadges)
const totalCount = computed(() => badgeStore.totalCount)
const earnedSet = computed(() => badgeStore.earnedCodes)
const earnedCountForStats = computed(() => badgeStore.earnedCount)
const progressPercent = computed(() => badgeStore.percent)
const myBadges = computed(() => badgeStore.myBadges)
const progress = computed(() => badgeStore.progress)
const overview = computed(() => badgeStore.overview)
const grantLogs = computed(() => badgeStore.grantLogs)

const earnedMap = computed(() => {
  const m = {}
  for (const b of myBadges.value) m[b.code] = b
  return m
})
const recentEarned = computed(() =>
  [...myBadges.value].sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)).slice(0, 5)
)
const heatmapData = computed(() => progress.value?.heatmap || [])

// 教师矩阵统计
const classEarnedRate = computed(() => {
  if (!overview.value) return 0
  const total = (overview.value.students?.length || 0) * (overview.value.badges?.length || 0)
  if (!total) return 0
  let owned = 0
  const o = overview.value.owned || {}
  for (const k of Object.keys(o)) owned += (o[k] || []).length
  return Math.round((owned / total) * 100)
})
const classAvgBadges = computed(() => {
  if (!overview.value || !(overview.value.students?.length)) return 0
  const o = overview.value.owned || {}
  let sum = 0
  for (const k of Object.keys(o)) sum += (o[k] || []).length
  return (sum / overview.value.students.length).toFixed(1)
})

function hasBadge(userId, badgeId) {
  const arr = overview.value?.owned?.[userId] || []
  return arr.includes(badgeId)
}

// ── 教师矩阵开关 ──
const showMatrix = ref(true)
function toggleMatrix() { showMatrix.value = !showMatrix.value }

// ── 弹窗状态 ──
const showGrantDialog = ref(false)
const showBatch = ref(false)
const showLibrary = ref(false)
const showLibForm = ref(false)
const showLogs = ref(false)
const showDetailDialog = ref(false)
const detailBadge = ref(null)

// 学生徽章快捷管理（点姓名进入）
const showStudentDialog = ref(false)
const studentMgr = ref(null)
const studentMgrIds = ref([])

const granting = ref(false)
const batchGranting = ref(false)
const libSaving = ref(false)
const loadingStudents = ref(false)
const studentList = ref([])

const grantForm = ref({ userId: null, stuName: '', code: '' })
const batchForm = ref({ userIds: [], code: '' })
const libForm = ref({ id: null, code: '', name: '', description: '', icon: 'Trophy', category: 'STREAK', threshold: 0, sort_order: 0 })

// ── 工具函数 ──
function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN')
}
// 从 after_snapshot(JSON) 中解析可读详情，用于授予记录时间线
function logDetail(log) {
  try {
    const obj = typeof log.after_snapshot === 'string' ? JSON.parse(log.after_snapshot) : (log.after_snapshot || {})
    return obj.detail || ''
  } catch {
    return ''
  }
}
function categoryLabel(cat) { return categoryMap[cat] || cat }
function thresholdTextLocal(badge) {
  if (badge.category === 'STREAK') return `连续 ${badge.threshold} 天打卡`
  if (badge.category === 'CREDIT') return `累计 ${badge.threshold} 积分`
  if (badge.category === 'SUBJECT') return `完成 ${badge.threshold} 篇笔记`
  if (badge.category === 'HABIT') return `连续 ${badge.threshold} 次早提交`
  if (badge.category === 'SOCIAL') return `获得 ${badge.threshold} 次好评`
  return `达成条件解锁`
}
function earnedIconStyle(badge) {
  const gradients = {
    MILESTONE: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    STREAK: 'linear-gradient(135deg, #06B6D4, #67E8F9)',
    QUALITY: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
    CREDIT: 'linear-gradient(135deg, #EC4899, #F9A8D4)',
    HABIT: 'linear-gradient(135deg, #10B981, #6EE7B7)',
    SUBJECT: 'linear-gradient(135deg, #6366F1, #A5B4FC)',
    SOCIAL: 'linear-gradient(135deg, #F97316, #FDBA74)',
    SPECIAL: 'linear-gradient(135deg, #EF4444, #FCA5A5)',
  }
  return { background: gradients[badge.category] || 'linear-gradient(135deg, #7C3AED, #A78BFA)', color: '#fff' }
}

// ── 撒花庆祝 ──
function celebrate() {
  const layer = confettiLayer.value
  if (!layer) return
  const colors = ['#7C3AED', '#06B6D4', '#F59E0B', '#EC4899', '#10B981', '#F97316']
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('span')
    p.className = 'confetti-piece'
    p.style.left = Math.random() * 100 + 'vw'
    p.style.background = colors[i % colors.length]
    p.style.animationDelay = (Math.random() * 0.25) + 's'
    p.style.setProperty('--rot', (Math.random() * 360) + 'deg')
    layer.appendChild(p)
    setTimeout(() => p.remove(), 1500)
  }
}

// ── 交互 ──
function onBadgeClick(badge) {
  detailBadge.value = badge
  showDetailDialog.value = true
}

async function onMatrixCell(stu, badge) {
  if (hasBadge(stu.id, badge.id)) {
    try {
      await ElMessageBox.confirm(`撤销 ${stu.name} 的「${badge.name}」？`, '确认撤销', { type: 'warning' })
    } catch (_) { return }
    try {
      await badgeStore.revoke(stu.id, badge.code)
      ElMessage.success('已撤销')
      await badgeStore.loadOverview(true)
    } catch (_) {}
  } else {
    grantForm.value = { userId: stu.id, stuName: stu.name, code: '' }
    showGrantDialog.value = true
  }
}

async function doGrant() {
  granting.value = true
  try {
    await badgeStore.grant(grantForm.value.userId, grantForm.value.code)
    ElMessage.success('徽章颁发成功！')
    celebrate()
    showGrantDialog.value = false
    await Promise.all([badgeStore.loadMyBadges(true), badgeStore.loadOverview(true), badgeStore.loadProgress(true)])
  } catch (_) {}
  granting.value = false
}

async function openBatch() {
  // 优先用已加载的班级概览，免一次网络请求 → 弹窗即时打开（反映更及时）
  if (overview.value?.students?.length) {
    studentList.value = overview.value.students
  } else {
    loadingStudents.value = true
    try {
      const res = await listUsers({ role: 'STUDENT' })
      studentList.value = res.data || res || []
    } catch (_) {}
    loadingStudents.value = false
  }
  batchForm.value = { userIds: [], code: '' }
  showBatch.value = true
}

// 点学生姓名 → 进入该生徽章快捷管理
function openStudentManage(stu) {
  studentMgr.value = stu
  studentMgrIds.value = [...(overview.value?.owned?.[stu.id] || [])]
  showStudentDialog.value = true
}

// 即时授予 / 撤销（乐观更新，无需逐个 confirm）
async function toggleStudentBadge(badge) {
  const stu = studentMgr.value
  if (!stu) return
  const has = studentMgrIds.value.includes(badge.id)
  // 乐观更新
  studentMgrIds.value = has
    ? studentMgrIds.value.filter((id) => id !== badge.id)
    : [...studentMgrIds.value, badge.id]
  try {
    if (has) await badgeStore.revoke(stu.id, badge.code)
    else await badgeStore.grant(stu.id, badge.code)
    ElMessage.success(has ? `已撤销 ${stu.name} 的「${badge.name}」` : `已颁发「${badge.name}」给 ${stu.name}`)
    celebrate()
    await badgeStore.loadOverview(true)
    // 以最新概览为准，保证矩阵与本弹窗一致
    studentMgrIds.value = [...(overview.value?.owned?.[stu.id] || [])]
  } catch (_) {
    // 失败回滚
    studentMgrIds.value = has
      ? [...studentMgrIds.value, badge.id]
      : studentMgrIds.value.filter((id) => id !== badge.id)
  }
}

async function doBatchGrant() {
  batchGranting.value = true
  try {
    const code = batchForm.value.code
    const grants = batchForm.value.userIds.map((userId) => ({ userId, code }))
    const r = await badgeStore.grantBatch(grants)
    const okCount = r?.successCount ?? grants.length
    ElMessage.success(`已成功颁发给 ${okCount} 人`)
    celebrate()
    showBatch.value = false
    await Promise.all([badgeStore.loadOverview(true), badgeStore.loadGrantLogs(true)])
  } catch (_) {}
  batchGranting.value = false
}

// ── 徽章库 ──
function openLibCreate() {
  libForm.value = { id: null, code: '', name: '', description: '', icon: 'Trophy', category: 'STREAK', threshold: 0, sort_order: 0 }
  showLibForm.value = true
}
function openLibEdit(row) {
  libForm.value = { ...row }
  showLibForm.value = true
}
async function saveLib() {
  if (!libForm.value.code || !libForm.value.name) { ElMessage.warning('请填写 code 和名称'); return }
  libSaving.value = true
  try {
    if (libForm.value.id) await badgeStore.update(libForm.value.id, { ...libForm.value })
    else await badgeStore.create({ ...libForm.value })
    ElMessage.success('已保存')
    showLibForm.value = false
    await badgeStore.loadAllBadges(true)
  } catch (_) {}
  libSaving.value = false
}
async function doDelete(row) {
  try {
    await ElMessageBox.confirm(`删除「${row.name}」？已颁发记录也会清除。`, '确认删除', { type: 'warning' })
  } catch (_) { return }
  try {
    await badgeStore.remove(row.id)
    ElMessage.success('已删除')
    await badgeStore.loadAllBadges(true)
  } catch (_) {}
}

async function openLogs() {
  await badgeStore.loadGrantLogs(true)
  showLogs.value = true
}

// ── 加载 ──
async function load() {
  loading.value = true
  try {
    await badgeStore.loadAllBadges()
    if (isTeacherOrAdmin.value) {
      await Promise.all([badgeStore.loadOverview(), badgeStore.loadMyBadges()])
    } else {
      await Promise.all([badgeStore.loadMyBadges(), badgeStore.loadProgress()])
    }
  } catch (_) {}
  finally { loading.value = false }
}

function onOpenBatchEvent() { openBatch() }

onMounted(() => {
  load()
  window.addEventListener('app:open-batch-grant', onOpenBatchEvent)
})
onBeforeUnmount(() => {
  window.removeEventListener('app:open-batch-grant', onOpenBatchEvent)
})
</script>

<style scoped>
.hall-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; margin: 0 auto; }

.confetti-layer { position: fixed; inset: 0; pointer-events: none; z-index: 4000; overflow: hidden; }
.confetti-piece {
  position: fixed; top: -12px; width: 8px; height: 12px; border-radius: 2px;
  animation: confetti-fall 1.4s ease-in forwards;
}
@keyframes confetti-fall {
  to { top: 100vh; opacity: 0; transform: translateX(40px) rotate(calc(var(--rot) + 360deg)); }
}

/* ── Hero Banner ── */
.hero {
  position: relative; border-radius: 18px; overflow: hidden; min-height: 160px;
}
.hero-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #06B6D4 100%); }
.hero-bg::after { content: ''; position: absolute; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.08); top: -60px; right: -40px; }
.hero-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px; padding: 24px 24px 20px; color: #fff; }
.hero-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.15); flex-shrink: 0; }
.hero-text h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.hero-text p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.hero-stats { margin-left: auto; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.12); padding: 8px 16px; border-radius: 12px; backdrop-filter: blur(8px); }
.stat { text-align: center; }
.stat b { display: block; font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat span { font-size: 11px; opacity: 0.75; }
.stat-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.2); }

/* ── Teacher Bar ── */
.teacher-bar { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }

/* ── 进度卡片 ── */
.progress-card { padding: 18px; }
.pc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.pc-title { font-size: 15px; font-weight: 600; }
.pc-percent { font-size: 18px; font-weight: 700; color: var(--brand); }
.pc-bar { height: 10px; border-radius: 6px; background: var(--bg-subtle); overflow: hidden; }
.pc-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #7C3AED, #06B6D4); transition: width 0.6s ease; }
.pc-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; font-size: 13px; color: var(--text-soft); }
.pc-meta span { display: inline-flex; align-items: center; gap: 4px; }
.pc-next { color: var(--brand); font-weight: 600; }
.pc-hint { margin-top: 8px; font-size: 12px; color: var(--text-muted); }

/* ── Section Title ── */
.section-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.count-hint { font-size: 13px; font-weight: 400; color: var(--text-soft); }

/* ── Loading Skeleton ── */
.loading { display: flex; flex-direction: column; gap: 14px; padding: 20px; background: #fff; border: 1px solid var(--border); border-radius: 14px; }
.sk-row { display: flex; align-items: center; gap: 12px; }
.sk-text { display: flex; flex-direction: column; gap: 6px; flex: 1; }

/* ── Empty ── */
.empty { text-align: center; padding: 32px 16px; }
.empty p { margin: 10px 0 0; color: var(--text-soft); }
.empty .sub { font-size: 12px; color: var(--text-muted); }
.card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 18px; }

/* ── 班级矩阵 ── */
.matrix-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; border: 1px solid var(--border); }
.matrix-table { border-collapse: collapse; width: 100%; min-width: 480px; }
.matrix-table th, .matrix-table td { border: 1px solid var(--border); padding: 8px 6px; text-align: center; font-size: 12px; }
.matrix-table th { background: var(--bg); position: sticky; top: 0; z-index: 1; }
.matrix-table th:first-child, .matrix-table td:first-child { position: sticky; left: 0; background: var(--bg); z-index: 2; }
.matrix-table thead th:first-child { z-index: 3; }
.m-stu { text-align: left !important; white-space: nowrap; font-size: 12px; min-width: 92px; }
.m-stu small { color: var(--text-muted); }
.stu-clickable { cursor: pointer; border-radius: 8px; padding: 4px 6px; transition: background 0.15s ease; }
.stu-clickable:hover { background: var(--brand-50); }
.stu-manage-hint { display: none; }
@media (max-width: 600px) {
  .stu-clickable { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .stu-manage-hint { display: inline-block; font-size: 10px; color: var(--brand); background: var(--brand-soft); padding: 1px 6px; border-radius: 6px; font-weight: 600; }
}
.m-cell { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; }
.m-cell.on { background: var(--brand-soft); color: var(--brand); }
.m-cell.off { background: var(--bg-subtle); color: transparent; }
.m-cell.off:hover { background: var(--brand-50); color: var(--brand); }

/* ── 九宫格 ── */
.badge-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.badge-card { cursor: pointer; border-radius: 14px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.badge-card:hover { transform: translateY(-3px); }
.badge-card.earned { background: linear-gradient(180deg, #fffbf0 0%, #fff8e6 100%); border: 1px solid rgba(245, 158, 11, 0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
.badge-card.locked { background: #fafbfc; border: 1px solid var(--border); opacity: 0.75; }
.card-inner { padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.badge-icon-wrap { position: relative; width: 56px; height: 56px; }
.badge-img { width: 56px; height: 56px; border-radius: 16px; object-fit: contain; display: block; transition: transform 0.2s ease, filter 0.2s ease; }
.badge-card:hover .badge-img { transform: scale(1.08); }
.badge-card.locked .badge-img { filter: grayscale(100%) opacity(0.55); }
.lock-overlay { position: absolute; inset: 0; border-radius: 16px; background: rgba(241, 243, 247, 0.55); display: flex; align-items: center; justify-content: center; color: #9ca3af; }
.check-badge { position: absolute; bottom: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #10B981; color: #fff; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
.badge-name { font-size: 13px; font-weight: 600; color: var(--text); }
.badge-desc { font-size: 11px; color: var(--text-soft); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.badge-status { display: flex; align-items: center; gap: 6px; }
.earned-date { font-size: 11px; color: var(--brand); }

/* ── 最近获得 ── */
.recent-list { display: flex; flex-direction: column; gap: 8px; }
.recent-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--bg); }
.recent-img { width: 32px; height: 32px; border-radius: 8px; object-fit: contain; flex-shrink: 0; background: var(--bg-subtle); }
.recent-info { display: flex; flex-direction: column; }
.recent-info b { font-size: 13px; }
.recent-info span { font-size: 11px; color: var(--text-soft); }

/* ── 颁发弹窗内的徽章选择网格 ── */
.grant-badge-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.grant-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; transition: all 0.15s ease; background: var(--bg-subtle); }
.grant-option:hover { border-color: var(--brand-200); background: var(--brand-50); }
.grant-option.selected { border-color: var(--brand); background: var(--brand-soft); }
.grant-option span { font-size: 11px; text-align: center; line-height: 1.3; }

/* ── 徽章库 ── */
.lib-toolbar { margin-bottom: 12px; display: flex; justify-content: flex-end; }

/* ── 学生徽章快捷管理 ── */
.stu-mgr-tip { font-size: 12px; color: var(--text-soft); margin: 0 0 12px; }
.stu-mgr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.stu-mgr-chip {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 8px; border-radius: 12px; border: 2px solid var(--border); cursor: pointer;
  background: #fff; transition: all 0.15s ease; font-size: 12px; text-align: center; line-height: 1.3;
}
.stu-mgr-chip:hover { border-color: var(--brand-200); }
.stu-mgr-chip.on { border-color: var(--brand); background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.stu-mgr-check {
  position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; border-radius: 50%;
  background: #10B981; color: #fff; display: flex; align-items: center; justify-content: center;
}

/* ── 详情弹窗 ── */
.detail-body { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.detail-img { width: 88px; height: 88px; border-radius: 22px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.detail-quote { text-align: center; font-size: 14px; color: var(--brand); font-weight: 600; margin: 0; line-height: 1.6; }
.detail-desc { text-align: center; color: var(--text-soft); font-size: 13px; line-height: 1.6; margin: 0; }
.detail-meta { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.meta-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.meta-label { color: var(--text-soft); }

/* ── 响应式 ── */
@media (max-width: 600px) {
  .badge-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .card-inner { padding: 12px 6px; }
  .badge-icon-wrap, .badge-img { width: 46px; height: 46px; border-radius: 12px; }
  .badge-name { font-size: 12px; }
  .badge-desc { font-size: 10px; -webkit-line-clamp: 1; }
  .hero-content { flex-direction: column; text-align: center; padding: 20px 16px; }
  .hero-stats { margin-left: 0; margin-top: 12px; width: 100%; justify-content: center; }
  .grant-badge-grid { grid-template-columns: repeat(2, 1fr); }
  .stu-mgr-grid { grid-template-columns: repeat(2, 1fr); }
  /* 弹窗在手机上：限制高度 + 内容区滚动，避免显示不全；圆角 + 实底，避免与背景重影 */
  .mobile-fit.el-dialog {
    width: 92vw !important; max-width: 92vw;
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex; flex-direction: column;
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  }
  .mobile-fit .el-dialog__header { padding: 16px 18px 8px !important; margin-right: 0 !important; flex-shrink: 0; }
  .mobile-fit .el-dialog__title { font-size: 16px; font-weight: 700; }
  .mobile-fit .el-dialog__body { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 18px 16px !important; }
  .mobile-fit .el-dialog__footer { padding: 10px 18px 16px !important; flex-shrink: 0; }
}
/* 手机端遮罩略加深，弱化背景文字透出的重影感 */
@media (max-width: 600px) {
  .el-overlay { background-color: rgba(15, 23, 42, 0.55); }
}
</style>
