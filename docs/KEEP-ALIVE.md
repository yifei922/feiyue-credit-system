# 解决 Render 免费层冷启动（APPLICATION LOADING）

## 问题

Render 免费套餐在 **15 分钟无请求后自动休眠**，下次访问需 30~60 秒冷启动，期间显示 `APPLICATION LOADING` 页面。

**这不是 bug，是免费层的限制。**

## 解决方案总览

| 方案 | 成本 | 效果 | 推荐度 |
|------|------|------|--------|
| A. UptimeRobot 保活 | 免费 | ⭐⭐⭐⭐⭐ | **首选** |
| B. cron-job.org 保活 | 免费 | ⭐⭐⭐⭐ | 备选 |
| C. 升级 Starter 计划 | $7/月 | ⭐⭐⭐⭐⭐ | 长期方案 |

---

## 方案 A：UptimeRobot（推荐，2 分钟搞定）

### 步骤

1. 打开 https://uptimerobot.com ，注册免费账号
2. 点击 **+ Add New Monitor**：
   - Monitor Type：`HTTP(s)`
   - URL：`https://feiyue-credit.onrender.com/api/health`
   - Monitoring Interval：**5 分钟**（免费版最短）
3. 点击 Create Monitor → 完成！

### 原理

UptimeRobot 每 5 分钟访问一次 `/api/health`（轻量 JSON 响应 <1ms），Render 检测到请求就不会休眠。**冷启动问题基本消除。**

> 💡 `/api/health` 是专门为保活设计的端点，不做任何数据库查询，响应极快。

---

## 方案 B：cron-job.org

1. 打开 https://cron-job.org/en/create/ （免费注册）
2. 配置：
   - Title：`feiyue-credit-keep-alive`
   - Execution schedule：**Every 10 minutes**
   - URL：`https://feiyue-credit.onrender.com/api/health`
   - Request method：`GET`
3. 保存启用

---

## 方案 C：升级付费（彻底解决）

在 Render Dashboard → feiyue-credit 服务 → Settings → Change Plan：

| 计划 | 价格 | 特性 |
|------|------|------|
| Free | $0 | 冷启动、750h/月 |
| **Starter** | **$7/月** | **常驻运行、无冷启动** |

升级后服务 **7×24 在线**，不再出现 APPLICATION LOADING。

---

## 已做的代码优化

本次已优化以下配置来减少唤醒时间：

- ✅ 新增 `/api/health` 轻量健康检查端点（替代 `/` 全页加载）
- ✅ render.yaml 中 `healthCheckPath` 改为 `/api/health`（更快判定就绪）
- ✅ 健康检查不经过鉴权中间件，响应 <1ms
