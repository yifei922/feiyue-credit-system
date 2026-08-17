<template>
  <div class="hall-page">
    <!-- ── 英雄区（Hero Banner）── -->
    <div class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <div class="hero-icon">
          <el-icon :size="32"><Trophy /></el-icon>
        </div>
        <div class="hero-text">
          <h1>荣誉殿堂</h1>
          <p>每一枚徽章，都是成长的见证</p>
        </div>
        <div class="hero-stats">
          <div class="stat">
            <b>{{ earnedCount }}</b>
            <span>已获得</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <b>{{ allBadges.length }}</b>
            <span>总徽章</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <b>{{ progressPercent }}%</b>
            <span>收集度</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 教师操作栏（仅教师/管理员可见）── -->
    <div class="teacher-bar" v-if="isTeacherOrAdmin">
      <el-button type="primary" @click="showGrantDialog = true" :icon="Medal">
        颁发徽章
      </el-button>
    </div>

    <!-- ── 九宫格徽章墙── -->
    <div class="grid-section">
      <div class="section-title">
        <span>徽章墙</span>
        <span class="count-hint">{{ earnedCount }}/{{ allBadges.length }}</span>
      </div>

      <div class="loading" v-if="loading">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span>加载中…</span>
      </div>

      <div class="empty card" v-else-if="allBadges.length === 0">
        <el-icon :size="48" color="#c0bfc0"><Trophy /></el-icon>
        <p>暂无徽章数据</p>
        <p class="sub">管理员可在后台配置徽章</p>
      </div>

      <div class="badge-grid" v-else>
        <div
          v-for="b in allBadges"
          :key="b.code"
          class="badge-card"
          :class="{ earned: earnedCodes.has(b.code), locked: !earnedCodes.has(b.code) }"
          @click="onBadgeClick(b)"
        >
          <div class="card-inner">
            <div class="badge-icon-wrap">
              <div class="badge-icon" :style="earnedCodes.has(b.code) ? earnedIconStyle(b) : {}">
                <el-icon :size="earnedCodes.has(b.code) ? 28 : 22">
                  <component :is="iconMap[b.icon] || 'Trophy'" />
                </el-icon>
              </div>
              <div class="lock-overlay" v-if="!earnedCodes.has(b.code)">
                <el-icon :size="18"><Lock /></el-icon>
              </div>
              <div class="check-badge" v-if="earnedCodes.has(b.code)">
                <el-icon :size="12"><Check /></el-icon>
              </div>
            </div>
            <div class="badge-name">{{ b.name }}</div>
            <div class="badge-desc">{{ b.description }}</div>
            <div class="badge-status" v-if="earnedCodes.has(b.code)">
              <span class="earned-date">{{ formatDate(earnedMap[b.code]?.earnedAt) }} 获得</span>
            </div>
            <div class="badge-status" v-else>
              <el-tag size="small" type="info" effect="plain">未解锁</el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 最近获得（有获得记录时显示）── -->
    <div class="recent-section card" v-if="earnedList.length > 0">
      <div class="section-title">最近获得</div>
      <div class="recent-list">
        <div class="recent-item" v-for="item in recentEarned" :key="item.code + item.earnedAt">
          <div class="recent-icon" style="background: var(--brand-soft); color: var(--brand)">
            <el-icon :size="16"><Trophy /></el-icon>
          </div>
          <div class="recent-info">
            <b>{{ item.name }}</b>
            <span>{{ formatDate(item.earnedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 教师颁发弹窗── -->
    <el-dialog v-model="showGrantDialog" title="颁发徽章" width="420px" :close-on-click-modal="false">
      <el-form :model="grantForm" label-width="80px">
        <el-form-item label="选择学生">
          <el-select
            v-model="grantForm.userId"
            filterable
            placeholder="搜索学生姓名/学号"
            style="width: 100%"
            :loading="loadingStudents"
          >
            <el-option
              v-for="s in studentList"
              :key="s.id"
              :label="`${s.name} (${s.studentNo || s.username})`"
              :value="s.id"
            />
          </el-select>
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
              <el-icon :size="20"><component :is="iconMap[b.icon] || 'Trophy'" /></el-icon>
              <span>{{ b.name }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGrantDialog = false">取消</el-button>
        <el-button type="primary" :loading="granting" @click="doGrant" :disabled="!grantForm.userId || !grantForm.code">
          确认颁发
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 徽章详情弹窗── -->
    <el-dialog v-model="showDetailDialog" :title="detailBadge?.name" width="380px">
      <div class="detail-body" v-if="detailBadge">
        <div class="detail-icon" :style="earnedCodes.has(detailBadge?.code) ? earnedIconStyle(detailBadge) : { background: '#f1f3f7', color: '#8a94a6' }">
          <el-icon :size="36"><component :is="iconMap[detailBadge.icon] || 'Trophy'" /></el-icon>
        </div>
        <p class="detail-desc">{{ detailBadge.description }}</p>
        <div class="detail-meta">
          <div class="meta-row">
            <span class="meta-label">类别</span>
            <el-tag size="small">{{ categoryLabel(detailBadge.category) }}</el-tag>
          </div>
          <div class="meta-row" v-if="detailBadge.threshold > 0">
            <span class="meta-label">解锁条件</span>
            <span>{{ thresholdText(detailBadge) }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">状态</span>
            <el-tag :type="earnedCodes.has(detailBadge?.code) ? 'success' : 'info'" size="small">
              {{ earnedCodes.has(detailBadge?.code) ? '已获得' : '未解锁' }}
            </el-tag>
          </div>
          <div class="meta-row" v-if="earnedCodes.has(detailBadge?.code)">
            <span class="meta-label">获得时间</span>
            <span>{{ formatDate(earnedMap[detailBadge?.code]?.earnedAt) }}</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Trophy, Lock, Check, Medal, Loading, User, Calendar, Star, Sunny, Service, Connection, Prize } from '@element-plus/icons-vue'
import { listAllBadges, listMyBadges, grantBadge } from '@/api/badge'
import { useAuthStore } from '@/stores/auth'
import { listUsers } from '@/api/user'

const auth = useAuthStore()
const loading = ref(true)
const allBadges = ref([])
const earnedList = ref([])

// 图标映射
const iconMap = {
  Trophy, User, Calendar, Star, Medal, Sunny, Service: Reading, Connection: Hands, Prize: Crown,
  Check, Lock,
}

// 计算属性
const earnedCodes = computed(() => new Set(earnedList.value.map((b) => b.code)))
const earnedMap = computed(() => { const m = {}; for (const b of earnedList.value) m[b.code] = b; return m })
const earnedCount = computed(() => earnedList.value.length)
const progressPercent = computed(() => {
  if (!allBadges.value.length) return 0
  return Math.round((earnedCount.value / allBadges.value.length) * 100)
})
const isTeacherOrAdmin = computed(() => ['ADMIN', 'TEACHER'].includes(auth.user?.role))
const recentEarned = computed(() => [...earnedList.value].sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)).slice(0, 5))

// 教师颁发相关
const showGrantDialog = ref(false)
const showDetailDialog = ref(false)
const detailBadge = ref(null)
const granting = ref(false)
const loadingStudents = ref(false)
const studentList = ref([])
const grantForm = ref({ userId: null, code: '' })

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN')
}

function categoryLabel(cat) {
  const map = {
    MILESTONE: '里程碑', STREAK: '连续打卡', QUALITY: '完美表现',
    CREDIT: '积分成就', HABIT: '好习惯', SUBJECT: '学科', SOCIAL: '社交',
    SPECIAL: '特殊荣誉'
  }
  return map[cat] || cat
}

function thresholdText(badge) {
  if (badge.category === 'STREAK') return `连续 ${badge.threshold} 天`
  if (badge.category === 'CREDIT') return `累计 ${badge.threshold} 积分`
  if (badge.category === 'SUBJECT') return `完成 ${badge.threshold} 篇笔记`
  if (badge.category === 'HABIT') return `连续 ${badge.threshold} 次早提交`
  if (badge.category === 'SOCIAL') return `获得 ${badge.threshold} 次好评`
  return `达成条件解锁`
}

function earnedIconStyle(badge) {
  // 每个类别用不同的渐变色
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

function onBadgeClick(badge) {
  detailBadge.value = badge
  showDetailDialog.value = true
}

async function load() {
  loading.value = true
  try {
    const [allR, myR] = await Promise.all([listAllBadges(), listMyBadges()])
    allBadges.value = allR.data || allR || []
    earnedList.value = myR.data || myR || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { loading.value = false }
}

async function loadStudents() {
  loadingStudents.value = true
  try {
    const res = await listUsers({ role: 'STUDENT' })
    studentList.value = res.data || res || []
  } catch (_) {}
  loadingStudents.value = false
}

async function doGrant() {
  granting.value = true
  try {
    await grantBadge(grantForm.value.userId, grantForm.value.code)
    ElMessage.success('徽章颁发成功！')
    showGrantDialog.value = false
    grantForm.value = { userId: null, code: '' }
    await load() // 刷新列表
  } catch (_) {}
  granting.value = false
}

onMounted(load)
</script>

<style scoped>
.hall-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; margin: 0 auto; }

/* ── Hero Banner ── */
.hero {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  min-height: 160px;
}
.hero-bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #06B6D4 100%);
}
.hero-bg::after {
  content: '';
  position: absolute;
  width: 200px; height: 200px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  top: -60px; right: -40px;
}
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 24px 20px;
  color: #fff;
}
.hero-icon {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  flex-shrink: 0;
}
.hero-text h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.hero-text p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
.hero-stats {
  margin-left: auto;
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.12);
  padding: 8px 16px;
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.stat { text-align: center; }
.stat b { display: block; font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat span { font-size: 11px; opacity: 0.75; }
.stat-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.2); }

/* ── Teacher Bar ── */
.teacher-bar { display: flex; justify-content: flex-end; }

/* ── Section Title ── */
.section-title {
  font-size: 16px; font-weight: 600;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.count-hint { font-size: 13px; font-weight: 400; color: var(--text-soft); }

/* ── Loading / Empty ── */
.loading {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 40px; color: var(--text-soft);
}
.empty { text-align: center; padding: 32px 16px; }
.empty p { margin: 10px 0 0; color: var(--text-soft); }
.empty .sub { font-size: 12px; color: var(--text-muted); }
.card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 18px; }

/* ── 九宫格 ── */
.badge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.badge-card {
  cursor: pointer;
  border-radius: 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.badge-card:hover { transform: translateY(-3px); }
.badge-card.earned { background: linear-gradient(180deg, #fffbf0 0%, #fff8e6 100%); border: 1px solid rgba(245, 158, 11, 0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
.badge-card.locked { background: #fafbfc; border: 1px solid var(--border); opacity: 0.75; }
.card-inner { padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }

.badge-icon-wrap { position: relative; width: 52px; height: 52px; }
.badge-icon {
  width: 52px; height: 52px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  background: #f1f3f7; color: #8a94a6;
  transition: transform 0.2s ease;
}
.badge-card:hover .badge-icon { transform: scale(1.08); }
.lock-overlay {
  position: absolute; inset: 0;
  border-radius: 14px;
  background: rgba(241, 243, 247, 0.7);
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af;
}
.check-badge {
  position: absolute; bottom: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #10B981; color: #fff;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #fff;
}
.badge-name { font-size: 13px; font-weight: 600; color: var(--text); }
.badge-desc { font-size: 11px; color: var(--text-soft); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.badge-status { display: flex; align-items: center; gap: 6px; }
.earned-date { font-size: 11px; color: var(--brand); }

/* ── 最近获得 ── */
.recent-section { padding: 16px 18px; }
.recent-list { display: flex; flex-direction: column; gap: 8px; }
.recent-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg);
}
.recent-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.recent-info { display: flex; flex-direction: column; }
.recent-info b { font-size: 13px; }
.recent-info span { font-size: 11px; color: var(--text-soft); }

/* ── 颁发弹窗内的徽章选择网格── */
.grant-badge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.grant-option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 6px; border-radius: 10px; border: 2px solid transparent;
  cursor: pointer; transition: all 0.15s ease;
  background: var(--bg-subtle);
}
.grant-option:hover { border-color: var(--brand-200); background: var(--brand-50); }
.grant-option.selected { border-color: var(--brand); background: var(--brand-soft); }
.grant-option span { font-size: 11px; text-align: center; line-height: 1.3; }

/* ── 详情弹窗── */
.detail-body { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.detail-icon {
  width: 72px; height: 72px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
}
.detail-desc { text-align: center; color: var(--text-soft); font-size: 13px; line-height: 1.6; margin: 0; }
.detail-meta { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.meta-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.meta-label { color: var(--text-soft); }

/* ── 响应式 ── */
@media (max-width: 600px) {
  .badge-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .card-inner { padding: 12px 8px; }
  .badge-icon-wrap, .badge-icon { width: 44px; height: 44px; border-radius: 12px; }
  .badge-name { font-size: 12px; }
  .badge-desc { font-size: 10px; -webkit-line-clamp: 1; }
  .hero-content { flex-direction: column; text-align: center; padding: 20px 16px; }
  .hero-stats { margin-left: 0; margin-top: 12px; width: 100%; justify-content: center; }
  .grant-badge-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
