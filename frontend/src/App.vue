<template>
  <router-view />
</template>

<script setup>
import { useShortcuts } from '@/composables/useShortcuts'
// 全局注册快捷键：Ctrl+S 保存、Ctrl+A 全选（完成登记页）
useShortcuts()
</script>
