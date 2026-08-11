// AI 助手路由（FF1 试验性）
// 当前为 stub：未配置 LLM_API_KEY 时返回配置提示与费用说明。
// 如需启用：在 server/.env 添加 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL；
//            支持任何 OpenAI 兼容 API（DeepSeek / Moonshot / 通义千问 / 智谱 GLM 等）。
const express = require('express');
const router = express.Router();
const { ok, fail } = require('../util');
const authMiddleware = require('../middleware/auth');

function llmConfigured() {
  return !!process.env.LLM_API_KEY && !!process.env.LLM_BASE_URL;
}

// 健康探测（公开）：前端用于判断是否启用 LLM（不暴露密钥）
router.get('/status', (_req, res) => {
  ok(res, { configured: llmConfigured() });
});

// 聊天（需登录）：当前未配置时返回友好提示；配置后转发到 LLM
router.post('/chat', authMiddleware, async (req, res) => {
  if (!llmConfigured()) {
    return fail(res, 503, 'AI 助手未启用：管理员需在 server/.env 配置 LLM_API_KEY（支持 OpenAI 兼容协议，详见 docs）');
  }

  // 真实实现示例（需安装 fetch / node>=18 已自带）：
  //   const messages = req.body?.messages || []
  //   const r = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
  //     },
  //     body: JSON.stringify({
  //       model: process.env.LLM_MODEL || 'deepseek-chat',
  //       messages: [{ role: 'system', content: '你是个人成长助手...' }, ...messages],
  //     }),
  //   });
  //   const j = await r.json();
  //   return ok(res, { content: j.choices[0].message.content });

  return fail(res, 501, 'LLM 客户端尚未实现：联系开发者在 server/src/routes/aiAssistant.js 启用真实转发');
});

module.exports = router;