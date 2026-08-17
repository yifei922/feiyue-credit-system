// 荣誉殿堂（徽章）store：统一管理徽章墙、进度、班级矩阵、批量颁发、徽章库 CRUD
import { defineStore } from 'pinia'
import {
  listAllBadges, listMyBadges, getBadgeProgress, grantBadge, grantBadgeBatch,
  revokeBadge, getClassOverview, getGrantLogs, createBadge, updateBadge, deleteBadge,
} from '@/api/badge'

export const useBadgeStore = defineStore('badge', {
  state: () => ({
    // 徽章库（全部定义）
    allBadges: [],
    badgesLoaded: false,
    // 当前用户已获得
    myBadges: [],
    myLoaded: false,
    // 进度（streak/heatmap/points）
    progress: null,
    progressLoaded: false,
    // 班级矩阵（教师/管理员）
    overview: null,
    overviewLoaded: false,
    // 授予记录
    grantLogs: [],
    logsLoaded: false,
    // 加载态
    loading: false,
  }),
  getters: {
    earnedCodes: (s) => new Set((s.myBadges || []).map((b) => b.code)),
    earnedCount: (s) => s.myBadges.length,
    totalCount: (s) => s.allBadges.length,
    percent: (s) => (s.allBadges.length ? Math.round((s.myBadges.length / s.allBadges.length) * 100) : 0),
  },
  actions: {
    async loadAllBadges(force = false) {
      if (this.badgesLoaded && !force) return this.allBadges
      this.loading = true
      try {
        const r = await listAllBadges()
        this.allBadges = r.data ?? r ?? []
        this.badgesLoaded = true
        return this.allBadges
      } finally {
        this.loading = false
      }
    },
    async loadMyBadges(force = false) {
      if (this.myLoaded && !force) return this.myBadges
      const r = await listMyBadges()
      this.myBadges = r.data ?? r ?? []
      this.myLoaded = true
      return this.myBadges
    },
    async loadProgress(force = false) {
      if (this.progressLoaded && !force) return this.progress
      const r = await getBadgeProgress()
      this.progress = r.data ?? r ?? null
      this.progressLoaded = true
      return this.progress
    },
    async loadOverview(force = false) {
      if (this.overviewLoaded && !force) return this.overview
      const r = await getClassOverview()
      this.overview = r.data ?? r ?? null
      this.overviewLoaded = true
      return this.overview
    },
    async loadGrantLogs(force = false) {
      if (this.logsLoaded && !force) return this.grantLogs
      const r = await getGrantLogs()
      this.grantLogs = r.data ?? r ?? []
      this.logsLoaded = true
      return this.grantLogs
    },
    // 教师/管理员：授予
    async grant(userId, code) {
      await grantBadge(userId, code)
      this.myLoaded = false
      this.overviewLoaded = false
      this.progressLoaded = false
    },
    async grantBatch(grants) {
      const r = await grantBadgeBatch(grants)
      this.myLoaded = false
      this.overviewLoaded = false
      this.progressLoaded = false
      this.logsLoaded = false
      return r.data ?? r
    },
    async revoke(userId, code) {
      await revokeBadge(userId, code)
      this.myLoaded = false
      this.overviewLoaded = false
    },
    // 管理员：徽章库 CRUD
    async create(payload) {
      await createBadge(payload)
      this.badgesLoaded = false
      this.overviewLoaded = false
    },
    async update(id, payload) {
      await updateBadge(id, payload)
      this.badgesLoaded = false
      this.overviewLoaded = false
    },
    async remove(id) {
      await deleteBadge(id)
      this.badgesLoaded = false
      this.overviewLoaded = false
    },
    reset() {
      this.allBadges = []
      this.myBadges = []
      this.progress = null
      this.overview = null
      this.grantLogs = []
      this.badgesLoaded = this.myLoaded = this.progressLoaded = this.overviewLoaded = this.logsLoaded = false
    },
  },
})
