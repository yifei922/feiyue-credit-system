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

      <p class="hint">默认账号：teacher01(教师) / rep01(科代) / student01(学生) / admin　·　密码均为 123456</p>

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
  background: linear-gradient(135deg, #eef2ff 0%, #f5f7fb 60%);
}
.login-card {
  width: 380px;
  background: #fff;
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 12px 40px rgba(31, 41, 55, 0.1);
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
  font-size: 20px;
  margin: 0;
}
.brand p {
  margin: 2px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}
.submit {
  width: 100%;
  margin-top: 8px;
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
  padding: 8px 10px;
  background: #f6f8ff;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: #5b6478;
  font-size: 12px;
  line-height: 1.5;
}
.cold-start-foot .el-icon {
  margin-top: 2px;
  color: #8893ad;
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
