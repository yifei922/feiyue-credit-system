<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <img src="/logo.jpg" alt="洛一高附中" class="logo-img" />
        <div>
          <h1>洛一高附中八（十）班</h1>
          <p>班级作业学分管理系统</p>
        </div>
      </div>

      <div class="powered-by">斐越科技出品</div>

      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            :prefix-icon="Lock"
            size="large"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="onSubmit">
          登 录
        </el-button>
      </el-form>

      <p class="hint">默认账号：teacher01(教师) / rep01(课代表) / student01(学生) / admin　·　密码均为 123456</p>

      <el-alert
        v-if="coldStartTip"
        type="info"
        :title="coldStartTip.title"
        :description="coldStartTip.desc"
        show-icon
        :closable="false"
        class="cold-start-alert"
      />

      <div class="cold-start-foot">
        <el-icon><InfoFilled /></el-icon>
        <span>本系统部署在免费服务器，首次打开可能需要 30–50 秒（冷启动），请耐心等候；之后会很快。</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Lock, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const loading = ref(false)
const coldStartTip = ref(null) // 冷启动时给出温馨提示（首屏明显延迟时弹出）
const formRef = ref()
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onSubmit() {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    coldStartTip.value = { title: '正在唤醒服务器…', desc: '免费服务器冷启动可能需要 30–50 秒，请稍候。' }
    try {
      const res = await login(form)
      auth.setAuth(res.data.token, res.data.user)
      ElMessage.success('登录成功')
      // 按角色落地不同首页：学生进入「学生端」，其余进入「数据看板」
      const role = res.data.user?.role
      const target = role === 'STUDENT' ? '/students' : (route.query.redirect || '/dashboard')
      router.push(target)
    } catch (e) {
      // 错误提示已由响应拦截器统一处理
      coldStartTip.value = null
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6D28D9 0%, #7C3AED 35%, #06B6D4 100%);
  position: relative;
  overflow: hidden;
}
/* 装饰性背景圆 — 增加层次感 */
.login-page::before {
  content: '';
  position: absolute;
  width: 420px; height: 420px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  top: -120px; right: -80px;
}
.login-page::after {
  content: '';
  position: absolute;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  bottom: -60px; left: -40px;
}
.login-card {
  width: 380px;
  background: #ffffff;
  border-radius: 20px;
  padding: 40px 32px 32px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1);
  position: relative;
  z-index: 1;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}
.logo-img {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  object-fit: contain;
}
.brand h1 {
  font-size: 21px;
  margin: 0;
  color: #1f2937;
}
.brand p {
  margin: 2px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}
.submit {
  width: 100%;
  margin-top: 12px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 6px;
  height: 48px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%);
  color: #ffffff !important;
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45), 0 2px 6px rgba(124, 58, 237, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 28px rgba(124, 58, 237, 0.55), 0 4px 10px rgba(124, 58, 237, 0.35);
}
.submit:active {
  transform: translateY(0);
}
.hint {
  margin-top: 18px;
  text-align: center;
  color: var(--text-soft);
  font-size: 12px;
}
.powered-by {
  text-align: center;
  font-size: 11px;
  color: #c0bfc0;
  margin-top: 12px;
  letter-spacing: 1px;
}
.cold-start-alert {
  margin-top: 14px;
}
.cold-start-foot {
  margin-top: 14px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border-radius: 10px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: #4c3a8c;
  font-size: 12px;
  line-height: 1.6;
  border: 1px solid rgba(124, 58, 237, 0.1);
}
.cold-start-foot .el-icon {
  margin-top: 2px;
  color: #7C3AED;
  flex-shrink: 0;
}

/* 手机端：登录卡片满宽、内边距收紧 */
@media (max-width: 768px) {
  .login-card {
    width: 90vw;
    max-width: 380px;
    padding: 28px 20px;
  }
}
</style>
