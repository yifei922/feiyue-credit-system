<template>
  <el-dialog
    v-model="open"
    title="AI 助手（试验性）"
    width="540px"
    :close-on-click-modal="false"
    role="dialog"
    aria-label="AI 助手对话框"
  >
    <el-alert
      v-if="!llmConfigured"
      type="warning"
      :closable="false"
      show-icon
      title="AI 助手未启用"
    >
      <template #default>
        <div class="alert-body">
          当前服务未配置 LLM_API_KEY，无法连接大模型。请管理员在 <code>server/.env</code> 中加入：
          <pre class="env-hint">LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat</pre>
          支持 OpenAI 兼容协议（DeepSeek / Moonshot / 通义千问 / 智谱 GLM 等），按 token 计费。
          <div class="cost-tip">
            <b>预计费用：</b>个人轻量使用约 ¥5–20/月；中度使用约 ¥30–80/月。<br>
            <b>替代方案（免费）：</b>改用本地规则（streak / 习惯分析 / 推荐补做）已足够日常使用，无需 LLM。
          </div>
        </div>
      </template>
    </el-alert>

    <div v-else class="chat-body">
      <div ref="scrollRef" class="chat-scroll">
        <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
          <div class="msg-text">{{ m.content }}</div>
        </div>
      </div>
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        placeholder="试试问：「我连续打卡 7 天了，有什么建议？」"
        @keydown.enter.exact.prevent="send"
      />
      <div class="chat-actions">
        <el-button :loading="loading" :disabled="!input.trim()" type="primary" @click="send">发送</el-button>
        <el-button @click="open = false">关闭</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
// AI 助手对话框（FF1 试验性）
// 当前后端未配置 LLM 时显示配置提示；配置后即可调用 OpenAI 兼容 API。
import { ref, nextTick } from 'vue'

const open = ref(false)
const input = ref('')
const loading = ref(false)
const llmConfigured = ref(false)
const messages = ref([
  { role: 'assistant', content: '你好！我是你的成长助手。当前 AI 助手尚未启用，请管理员配置 LLM_API_KEY 后即可对话。' },
])
const scrollRef = ref(null)

async function send() {
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  loading.value = true
  try {
    const { aiChat } = await import('@/api/ai')
    const res = await aiChat({ messages: messages.value })
    const reply = res?.data?.content || res?.content || '（无回复）'
    messages.value.push({ role: 'assistant', content: reply })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '请求失败：' + (e?.message || '未知错误') })
  } finally {
    loading.value = false
    nextTick(() => { if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight })
  }
}

// 暴露给外部触发
if (typeof window !== 'undefined') {
  window.addEventListener('app:open-ai', () => { open.value = true })
}

function checkConfig() {
  // 通过后端 health 探测是否启用 LLM（避免暴露 key）
  fetch('/api/ai/status')
    .then((r) => r.json())
    .then((j) => { llmConfigured.value = !!j?.data?.configured })
    .catch(() => { llmConfigured.value = false })
}

import { onMounted } from 'vue'
onMounted(checkConfig)
</script>

<style scoped>
.alert-body { font-size: 13px; line-height: 1.7; }
.env-hint {
  background: #1e293b;
  color: #e2e8f0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin: 6px 0;
  overflow-x: auto;
}
.cost-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-soft);
}
.chat-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 280px;
}
.chat-scroll {
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-3);
  background: var(--bg);
  border-radius: var(--radius-md);
}
.msg {
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  border-radius: var(--radius-md);
  max-width: 80%;
}
.msg.user {
  background: var(--brand);
  color: #fff;
  margin-left: auto;
}
.msg.assistant {
  background: var(--surface);
  border: 1px solid var(--border);
}
.chat-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>