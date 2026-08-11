import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// 各页面允许访问的角色白名单（meta.roles）
// 不设置或空数组 = 仅需登录即可；403 与 404 路由本身公开。
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/Forbidden.vue'),
    meta: { public: true, title: '无权限' }
  },
  {
    path: '/404',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { public: true, title: '页面不存在' }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] }
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/views/TaskList.vue'),
        meta: { title: '任务管理', roles: ['TEACHER', 'REP', 'ADMIN'] }
      },
      {
        path: 'completion',
        name: 'completion',
        component: () => import('@/views/CompletionRegister.vue'),
        meta: { title: '完成登记', roles: ['TEACHER', 'REP', 'ADMIN'] }
      },
      {
        path: 'students',
        name: 'students',
        component: () => import('@/views/StudentPortal.vue'),
        meta: { title: '学生端', roles: ['TEACHER', 'REP', 'ADMIN', 'STUDENT'] }
      },
      {
        path: 'manage',
        name: 'manage',
        component: () => import('@/views/StudentManage.vue'),
        meta: { title: '学生管理', roles: ['TEACHER', 'REP', 'ADMIN'] }
      },
      {
        path: 'resources',
        name: 'resources',
        component: () => import('@/views/ResourceManage.vue'),
        meta: { title: '课程资料', roles: ['TEACHER', 'REP', 'ADMIN'] }
      },
      {
        path: 'alerts',
        name: 'alerts',
        component: () => import('@/views/WarningCenter.vue'),
        meta: { title: '预警中心', roles: ['TEACHER', 'REP', 'ADMIN'] }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SystemSettings.vue'),
        meta: { title: '系统设置', roles: ['TEACHER', 'REP', 'ADMIN'] }
      }
    ]
  },
  // 兜底 404（必须放在最后）
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
]

const router = createRouter({
  // hash 模式：静态文件/本地预览下刷新子页面也不会 404，最稳
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  // 路由切换触发顶部进度条（监听 PageLoading 组件）
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('app:loading-start'))
  }
  const auth = useAuthStore()
  // 1) 公开页面直接放行
  if (to.meta.public) return true
  // 2) 未登录 → 跳登录（保留来源）
  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // 3) 角色白名单校验：当前角色不在白名单 → 403
  const roles = to.meta.roles
  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(auth.role)) {
    return { name: 'forbidden' }
  }
  // 4) 已登录访问 /login → 跳首页
  if (to.name === 'login' && auth.isLoggedIn) {
    return { name: 'dashboard' }
  }
  return true
})

router.afterEach(() => {
  // 短暂延迟确保 loading 视觉完整出现后再消失
  setTimeout(() => {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('app:loading-end'))
    }
  }, 220)
})

export default router