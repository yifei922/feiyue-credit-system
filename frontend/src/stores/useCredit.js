// 积分流水 store
import { defineStore } from 'pinia'
import { listCreditFlow } from '@/api/creditFlow'

export const useCreditStore = defineStore('credit', {
  state: () => ({
    items: [],
    loading: false,
    loaded: false,
    currentUserId: null,
  }),
  actions: {
    async fetchByUser(userId, force = false) {
      if (this.loaded && this.currentUserId === userId && !force) return this.items
      this.loading = true
      this.currentUserId = userId
      try {
        const r = await listCreditFlow({ userId })
        this.items = r.data ?? r
        this.loaded = true
        return this.items
      } finally {
        this.loading = false
      }
    },
    reset() {
      this.items = []
      this.loaded = false
      this.currentUserId = null
    },
  },
})