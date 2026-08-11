<template>
  <div class="forbidden-page">
    <el-result icon="warning" title="403 无权限访问" :sub-title="subtitle">
      <template #extra>
        <el-button type="primary" @click="goHome">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const subtitle = computed(() => {
  const role = auth.user?.role || '当前账号'
  return `当前账号（${role}）无权访问该页面。如有需要请联系管理员开通权限。`
})

function goHome() {
  router.push('/dashboard')
}
</script>

<style scoped>
.forbidden-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>