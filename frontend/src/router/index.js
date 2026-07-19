import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
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
        meta: { title: '数据看板' }
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/views/TaskList.vue'),
        meta: { title: '任务管理' }
      },
      {
        path: 'completion',
        name: 'completion',
        component: () => import('@/views/CompletionRegister.vue'),
        meta: { title: '完成登记' }
      },
      {
        path: 'students',
        name: 'students',
        component: () => import('@/views/StudentPortal.vue'),
        meta: { title: '学生端' }
      },
      {
        path: 'manage',
        name: 'manage',
        component: () => import('@/views/StudentManage.vue'),
        meta: { title: '学生管理' }
      },
      {
        path: 'alerts',
        name: 'alerts',
        component: () => import('@/views/WarningCenter.vue'),
        meta: { title: '预警中心' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SystemSettings.vue'),
        meta: { title: '系统设置' }
      }
    ]
  }
]

const router = createRouter({
  // hash 模式：静态文件/本地预览下刷新子页面也不会 404，最稳
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isLoggedIn) {
    return { name: 'dashboard' }
  }
})

export default router
