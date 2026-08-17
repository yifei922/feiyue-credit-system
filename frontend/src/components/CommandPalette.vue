<template>
  <transition name="palette-fade">
    <div v-if="open" class="palette-mask" @click.self="close">
      <div class="palette-panel" role="dialog" aria-label="命令面板">
        <el-input
          ref="inputRef"
          v-model="kw"
          placeholder="搜索：页面 / 操作（如：成员、任务、设置…）"
          size="large"
          clearable
          :prefix-icon="Search"
        />
        <div class="palette-list">
          <div
            v-for="(item, i) in filtered"
            :key="i"
            class="palette-item"
            :class="{ active: i === activeIdx }"
            @click="run(item)"
            @mouseenter="activeIdx = i"
          >
            <el-icon class="palette-ico"><component :is="item.icon" /></el-icon>
            <div class="palette-text">
              <div class="palette-title">{{ item.title }}</div>
              <div class="palette-sub">{{ item.sub }}</div>
            </div>
            <el-tag v-if="item.tag" size="small" effect="plain">{{ item.tag }}</el-tag>
          </div>
          <el-empty v-if="!filtered.length" description="未找到匹配项" :image-size="60" />
        </div>
        <div class="palette-foot">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
// 全局命令面板（O1）：Ctrl/Cmd + K 唤起，支持模糊搜索页面跳转 + 快捷操作
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Search, DataLine, Files, EditPen, User, UserFilled, Bell, Setting, Refresh,
  Lock, Document, Sunny, Trophy, Promotion
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const open = ref(false)
const kw = ref('')
const activeIdx = ref(0)
const inputRef = ref(null)

const NAV = computed(() => {
  const role = auth.user?.role
  const items = [
    { title: '数据看板', sub: '总览所有数据', icon: DataLine, route: '/dashboard', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] },
    { title: '任务管理', sub: '创建与跟踪任务', icon: Files, route: '/tasks', roles: ['TEACHER', 'REP', 'ADMIN'] },
    { title: '完成登记', sub: '批量登记任务完成情况', icon: EditPen, route: '/completion', roles: ['TEACHER', 'REP', 'ADMIN'] },
    { title: '学生端', sub: '查看成员主页', icon: User, route: '/students', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] },
    { title: '学生管理', sub: '成员名单与积分管理', icon: UserFilled, route: '/manage', roles: ['TEACHER', 'REP', 'ADMIN'] },
    { title: '预警中心', sub: '查看逾期/低积分等提醒', icon: Bell, route: '/alerts', roles: ['TEACHER', 'REP', 'ADMIN'] },
    { title: '系统设置', sub: '账号与系统配置', icon: Setting, route: '/settings', roles: ['TEACHER', 'REP', 'ADMIN'] },
    { title: '荣誉殿堂', sub: '徽章墙与成长激励', icon: Trophy, route: '/badges', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] },
  ]
  return items.filter((it) => !role || it.roles.includes(role))
})

const ACTIONS = computed(() => {
  const role = auth.user?.role
  const items = [
    { title: '刷新当前页', sub: '重新加载当前路由的数据', icon: Refresh, tag: '操作',
      run: () => window.dispatchEvent(new CustomEvent('app:reload')) },
    { title: '修改密码', sub: '前往修改个人密码', icon: Lock, tag: '账户',
      run: () => router.push('/settings') },
    { title: '切换主题', sub: '在浅色 / 深色模式间切换', icon: Sunny, tag: '主题',
      run: () => document.documentElement.dataset.theme =
        document.documentElement.dataset.theme === 'dark' ? '' : 'dark' },
  ]
  if (['TEACHER', 'ADMIN'].includes(role)) {
    items.push({
      title: '快速颁发徽章', sub: '进入荣誉殿堂并打开批量颁发', icon: Promotion, tag: '教师',
      run: () => {
        router.push('/badges')
        window.dispatchEvent(new CustomEvent('app:open-batch-grant'))
      },
    })
  }
  return items
})

const ALL_ITEMS = computed(() => [...NAV.value, ...ACTIONS.value])

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  const items = ALL_ITEMS.value
  if (!q) return items
  return items.filter((it) =>
    it.title.toLowerCase().includes(q) ||
    it.sub.toLowerCase().includes(q) ||
    (it.tag || '').toLowerCase().includes(q)
  )
})

watch(filtered, () => { activeIdx.value = 0 })

function run(item) {
  if (typeof item.run === 'function') {
    item.run()
  } else if (item.route) {
    router.push(item.route)
  }
  close()
}

function show() {
  open.value = true
  kw.value = ''
  activeIdx.value = 0
  nextTick(() => inputRef.value?.focus?.())
}
function close() { open.value = false }

function onKeydown(e) {
  if (!open.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = (activeIdx.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = (activeIdx.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = filtered.value[activeIdx.value]
    if (item) run(item)
  }
}

function onOpen() { show() }
function onClose() { close() }

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('app:open-palette', onOpen)
  window.addEventListener('app:close-palette', onClose)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('app:open-palette', onOpen)
  window.removeEventListener('app:close-palette', onClose)
})
</script>

<style scoped>
.palette-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.palette-panel {
  width: 560px;
  max-width: 92vw;
  max-height: 70vh;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}
.palette-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s ease;
}
.palette-item.active,
.palette-item:hover {
  background: var(--brand-soft);
}
.palette-ico {
  font-size: 18px;
  color: var(--brand);
}
.palette-text {
  flex: 1;
  min-width: 0;
}
.palette-title {
  font-size: var(--text-base);
  color: var(--text);
}
.palette-sub {
  font-size: var(--text-xs);
  color: var(--text-soft);
}
.palette-foot {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border);
  font-size: var(--text-xs);
  color: var(--text-soft);
}
kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: monospace;
  margin-right: 4px;
}
.palette-fade-enter-active, .palette-fade-leave-active {
  transition: opacity 0.15s ease;
}
.palette-fade-enter-from, .palette-fade-leave-to {
  opacity: 0;
}
</style>