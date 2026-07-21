<template>
  <el-container class="layout">
    <div class="backdrop" v-if="menuOpen" @click="menuOpen = false"></div>
    <el-aside width="220px" class="aside" :class="{ open: menuOpen }">
      <div class="logo">
        <img src="/logo.jpg" alt="洛一高附中" class="logo-img" />
        <span class="logo-text">洛一高附中十班</span>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="m in menus" :key="m.index" :index="m.index">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <el-icon class="hamburger" @click="menuOpen = !menuOpen"><Menu /></el-icon>
        <el-breadcrumb separator="/" class="crumb">
          <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="user">
          <el-dropdown @command="onCommand">
            <span class="user-trigger">
              <el-avatar :size="30" class="avatar">{{ userInitial }}</el-avatar>
              <span class="username">{{ auth.user?.realName || auth.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>

        <div class="footer">斐越科技出品</div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { DataLine, ArrowDown, Files, EditPen, User, UserFilled, Bell, Setting, Menu } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 手机端抽屉菜单状态
const menuOpen = ref(false)
function onMenuSelect() {
  menuOpen.value = false
}
function onResize() {
  if (window.innerWidth > 768 && menuOpen.value) menuOpen.value = false
}
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// 角色化菜单：学生仅可见「学生端 / 数据看板」，教师/科代/管理员可见全部管理模块
const ALL_MENUS = [
  { index: '/dashboard', label: '数据看板', icon: 'DataLine', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] },
  { index: '/tasks', label: '任务管理', icon: 'Files', roles: ['TEACHER', 'REP', 'ADMIN'] },
  { index: '/completion', label: '完成登记', icon: 'EditPen', roles: ['TEACHER', 'REP', 'ADMIN'] },
  { index: '/students', label: '学生端', icon: 'User', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] },
  { index: '/manage', label: '学生管理', icon: 'UserFilled', roles: ['TEACHER', 'REP', 'ADMIN'] },
  { index: '/alerts', label: '预警中心', icon: 'Bell', roles: ['TEACHER', 'REP', 'ADMIN'] },
  { index: '/settings', label: '系统设置', icon: 'Setting', roles: ['TEACHER', 'REP', 'ADMIN'] }
]
const ICONS = { DataLine, Files, EditPen, User, UserFilled, Bell, Setting }

const menus = computed(() => {
  const role = auth.user?.role || 'TEACHER'
  return ALL_MENUS.filter((m) => m.roles.includes(role)).map((m) => ({ ...m, icon: ICONS[m.icon] }))
})

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '洛一高附中十班')
const userInitial = computed(
  () => (auth.user?.realName || auth.user?.username || '?').charAt(0)
)

function onCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}
</script>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  background: #fff;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
}
.logo-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
}
.logo-text {
  font-size: 16px;
  font-weight: 600;
}
.menu {
  border-right: none;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid var(--border);
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.crumb {
  font-size: 14px;
}
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}
.avatar {
  background: var(--brand);
}
.username {
  font-size: 14px;
}
.main {
  background: var(--bg);
  padding: 24px;
  position: relative;
}
.footer {
  text-align: center;
  font-size: 11px;
  color: #c0bfc0;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  letter-spacing: 2px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 汉堡按钮默认隐藏（桌面端） */
.hamburger {
  display: none;
}

/* 小屏（手机 / iPad 竖屏）：侧边栏变抽屉 + 适配刘海安全区 */
@media (max-width: 768px) {
  .hamburger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    margin-right: 10px;
    color: var(--text);
  }
  .aside {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 2001;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.12);
  }
  .aside.open {
    transform: translateX(0);
  }
  .main {
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
  }
  .header {
    padding: 0 12px;
    padding-top: env(safe-area-inset-top);
  }
  .crumb {
    display: none;
  }
}

/* 抽屉遮罩 */
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 2000;
}
</style>
