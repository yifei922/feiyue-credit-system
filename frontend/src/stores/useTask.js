// 任务 store（按业务域拆分，Pinia）
import { defineStore } from 'pinia'
import { listTasks, createTask, updateTask, deleteTask } from '@/api/task'

export const useTaskStore = defineStore('task', {
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
        const r = await listTasks()
        this.items = r.data ?? r
        this.loaded = true
        return this.items
      } finally {
        this.loading = false
      }
    },
    async create(payload) {
      const r = await createTask(payload)
      this.loaded = false
      await this.fetch(true)
      return r
    },
    async update(id, payload) {
      const r = await updateTask(id, payload)
      this.loaded = false
      await this.fetch(true)
      return r
    },
    async remove(id) {
      const r = await deleteTask(id)
      this.loaded = false
      await this.fetch(true)
      return r
    },
    reset() {
      this.items = []
      this.loaded = false
    },
  },
})