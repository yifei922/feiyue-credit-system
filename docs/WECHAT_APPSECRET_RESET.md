# 微信小程序 AppSecret 重置 + Render 环境变量配置

> ⚠ 你之前在对话里直接发了完整 AppSecret（cfa72807...），**这有泄漏风险**——任何人只要拿到你的 AppSecret，就能：
> - 调用所有 wx.* 后端 API（用户登录、消息发送等）
> - 重置 access_token 让你的服务瘫痪
>
> **务必第一时间去微信公众平台重置**。

---

## 一、重置 AppSecret（5 分钟）

### 步骤 1：登录微信公众平台
1. 浏览器打开 https://mp.weixin.qq.com
2. 用小程序管理员微信扫码登录（不是普通微信扫码）
3. 如果你不是管理员 → 找管理员要权限或让其代为重置

### 步骤 2：进入「开发管理」
1. 左侧菜单 → **开发管理**
2. 选择「<b>开发设置</b>」标签
3. 找到「<b>小程序 AppSecret</b>」一栏

### 步骤 3：生成新的 AppSecret
1. 点击「<b>重置</b>」按钮
2. 弹出安全警告 → 用管理员微信扫码验证
3. 选择「<b>不发送至绑定邮箱</b>」（更安全）→ 直接页面展示
4. **立即复制保存到密码管理器**（1Password / Bitwarden / KeePass）
5. 关闭窗口后无法再次查看完整密钥，只能重置

### 步骤 4：核对服务器域名（你已添加过）
进入「开发管理 → 开发设置 → 服务器域名」，确认以下 3 项已填写：

| 域名类型 | 值 |
|---|---|
| request 合法域名 | `https://feiyue-credit.onrender.com` |
| uploadFile 合法域名 | `https://feiyue-credit.onrender.com` |
| downloadFile 合法域名 | `https://feiyue-credit.onrender.com` |

如果还没填，**点击「修改」→ 添加 → 保存**。

---

## 二、配置 Render 环境变量（2 分钟）

### 步骤 1：登录 Render Dashboard
1. https://dashboard.render.com → GitHub 登录
2. 找到服务 `feiyue-credit` → 点击进入

### 步骤 2：进入 Environment
1. 左侧菜单 → **Environment**
2. 点击「Add Environment Variable」两次，添加：

| Key | Value | 备注 |
|---|---|---|
| `WX_APP_ID` | `wx0fe78d74fdc47c1b` | 固定值，已公开 |
| `WX_APP_SECRET` | `<刚刚重置的新密钥>` | <b style="color:red">不要粘贴到聊天/日志</b> |
| `WX_AD_BANNER` | `adunit-xxx` | 申请通过后填；未通过留空 |
| `WX_AD_REWARD` | `adunit-yyy` | 同上 |

3. 点击「Save Changes」

### 步骤 3：触发自动重新部署
- Render 检测到环境变量变化后会自动重启服务
- 等待 30–60 秒
- 打开 Logs 标签，确认无报错

### 步骤 4：验证 AppSecret 已生效
打开浏览器访问：
```
https://feiyue-credit.onrender.com/api/health
```
应返回：
```json
{"status":"ok","ts":"2026-08-04T12:00:00.000Z"}
```

然后用微信开发者工具登录小程序（体验版），看能否正常 wx-login。**如果返回 503 "服务端未配置微信 AppSecret"**，说明环境变量未生效 → 等 1 分钟再试。

---

## 三、安全建议

| 风险 | 建议 |
|---|---|
| AppSecret 提交到 git | 仓库里只有 AppID（公开），<b>永远不要 commit AppSecret</b>。本项目已通过环境变量隔离。 |
| 同一个 AppSecret 被多人持有 | 只给最少必要的人；定期（如每 90 天）轮换一次 |
| AppSecret 显示在 Render Logs | Render Logs 会脱敏显示部分字符，但如果你手动打印会泄露 |
| AppSecret 写到聊天/工单 | 立即重置（按本文步骤 1） |

---

## 四、轮换计划（建议）

| 频率 | 操作 |
|---|---|
| 每 90 天 | 主动重置一次 AppSecret |
| 每次员工离职（接触过密钥） | 立即重置 |
| 发现可疑调用（access_token 异常消耗） | 立即重置并审计 access_token 日志 |

---

## 五、当前密钥状态（仅本仓库相关）

- ✅ AppID `wx0fe78d74fdc47c1b`：已写入 `miniprogram/project.config.json`（这是公开的，没问题）
- ⚠️ AppSecret：<b style="color:red">曾在对话中明文发出过</b>，必须按本文步骤 1 重置
- 📝 已写入 Render 环境变量：尚未（用户尚未提供新值）

---

## 六、紧急联系方式（如果发现密钥泄漏）

1. 立即到 mp.weixin.qq.com → 重置 AppSecret
2. 检查微信小程序后台「设置 → 第三方平台授权」→ 撤销可疑授权
3. 查看 Render Logs 中 `wx-login` 调用是否异常
4. 如有支付/订单相关业务，额外检查资金安全