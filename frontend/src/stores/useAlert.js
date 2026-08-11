// 预警 store
import { defineStore } from 'pinia'
import { listAlerts, resolveAlert } from '@/api/alert'

export const useAlertStore = defineStore('alert', {
  state: () => ({
    items: [],
    loading: false,
    loaded: false,
  }),
  actions: {
    async fetch(force = false) {
      if (this.loaded && !force) return this.items
      this.loading = true
      try {
        const r = await listAlerts()
        this.items = r.data ?? r
        this.loaded = true
        return this.items
      } finally {
        this.loading = false
      }
    },
    async resolve(id) {
      await resolveAlert(id)
      this.loaded = false
      await this.fetch(true)
    },
    reset() {
      this.items = []
      this.loaded = false
    },
  },
})