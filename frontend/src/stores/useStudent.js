// 成员 store（按业务域拆分）
import { defineStore } from 'pinia'
import { listStudents } from '@/api/student'

export const useStudentStore = defineStore('student', {
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
        const r = await listStudents()
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
    },
  },
})