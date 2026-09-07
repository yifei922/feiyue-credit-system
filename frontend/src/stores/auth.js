import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => s.user?.role,
    // 任务 5：双身份 —— REP 自动具备 STUDENT 能力
    effectiveRoles: (s) => s.user?.effectiveRoles || (s.user?.role ? [s.user.role] : []),
    // 是否具备学生能力（REP/TEACHER/ADMIN 都默认包含）
    canActAsStudent: (s) => {
      const r = s.user?.role
      return r === 'STUDENT' || r === 'REP' || r === 'TEACHER' || r === 'ADMIN'
    },
    // 是否具备课代表能力（REP/TEACHER/ADMIN）
    canActAsRep: (s) => {
      const r = s.user?.role
      return r === 'REP' || r === 'TEACHER' || r === 'ADMIN'
    },
  },
  actions: {
    setAuth(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    // 任务 5：实时刷新身份信息（设置课代表后无需重新登录）
    async refreshMe() {
      try {
        const { getMe } = await import('@/api/auth')
        const r = await getMe()
        const u = r.data ?? r
        this.user = { ...this.user, ...u }
        localStorage.setItem('user', JSON.stringify(this.user))
      } catch (_) { /* ignore */ }
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
