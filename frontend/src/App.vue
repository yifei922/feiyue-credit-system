<template>
  <PageLoading />
  <CommandPalette />
  <AIAssistantDialog />
  <router-view />
</template>

<script setup>
import { useShortcuts } from '@/composables/useShortcuts'
import PageLoading from '@/components/PageLoading.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import AIAssistantDialog from '@/components/AIAssistantDialog.vue'
// 全局注册快捷键：Ctrl+S 保存、Ctrl+A 全选（完成登记页）、Ctrl+K 命令面板
useShortcuts()
</script>
