# 🟢 Render 免费层保活方案

> **目标**：避免 `https://feiyue-credit.onrender.com` 因长时间无流量而进入 15 分钟冷启动（首次唤醒需 30–50 秒）。

---

## ✅ 推荐方案：UptimeRobot（免费外部保活，最稳）

| 项目 | 值 |
|---|---|
| 保活 URL | `https://feiyue-credit.onrender.com/api/health` |
| 期望状态码 | `200`（响应体 `{"status":"ok","ts":"..."}`） |
| 监测间隔 | **5 分钟**（300 秒） |
| 超时阈值 | 50 秒（≥ 冷启动时长，避免误判） |
| 监测位置 | 至少 1 个（推荐 2 个，错开地理位置） |

**配置步骤**：
1. 注册 [https://uptimerobot.com](https://uptimerobot.com)（免费版可监控 50 个 URL）
2. Add New Monitor → HTTP(s)
3. Friendly name: `洛一高附中八（十）班学分系统`
4. URL: `https://feiyue-credit.onrender.com/api/health`
5. Monitoring interval: `5 minutes`
6. Monitor Timeout: `50 seconds`
7. HTTP Method: `GET`
8. Keyword Value: `ok`（可选，进一步确认健康）
9. 添加告警联系人（邮件/微信/Telegram）
10. 保存即可

---

## 🛠️ 备选方案 A：本地机器保活脚本

适合：自己机器长期开机的开发者。

### Python 跨平台版 `keep_alive.py`
（已附在仓库根目录 `keep_alive.py`）

```bash
python keep_alive.py
```

- 默认每 5 分钟请求一次 `/api/health`
- 失败 3 次后退出（避免日志爆炸）
- 需要 Python 3.6+

### Windows 计划任务版
将以下内容保存为 `keep_alive.bat`，加入"任务计划程序"，开机自启 + 每 5 分钟触发一次：

```bat
@echo off
curl -fsS -o nul -w "%%{http_code}\n" https://feiyue-credit.onrender.com/api/health
```

---

## 🛠️ 备选方案 B：GitHub Actions 免费保活

适合：无独立机器，纯云端。

在仓库创建 `.github/workflows/keep-alive.yml`：

```yaml
name: Keep Render Alive
on:
  schedule: [{ cron: '*/5 * * * *' }]   # 每 5 分钟
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          STATUS=$(curl -fsS -o /dev/null -w "%{http_code}" https://feiyue-credit.onrender.com/api/health)
          echo "Render /api/health -> HTTP $STATUS"
          if [ "$STATUS" != "200" ]; then exit 1; fi
```

> GitHub Actions 免费额度：每月 2000 分钟，每 5 分钟一次约 8640 次 / 月，会**超额度**。建议间隔改为 `*/10 * * * *`（每 10 分钟）以留出余量。

---

## ❌ 不要做的事

| 反面操作 | 原因 |
|---|---|
| 间隔 < 1 分钟 | Render 会判定为滥用，可能触发速率限制或健康检查失败 → 服务被挂起 |
| 监控 `/` 根路径 | 静态前端路径不返回 JSON，且可能被 CDN 缓存导致响应异常 |
| 监控 `/api/auth/login` POST | POST 副作用大，不应作为健康探针 |
| 监控随机路径 | 浪费配额，无意义 |

---

## 🔍 验证当前保活状态

```bash
# 探测 5 次，看响应时间（首次通常 30-50 秒冷启动）
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "  #$i  HTTP=%{http_code}  t=%{time_total}s\n" \
    https://feiyue-credit.onrender.com/api/health
done
```

- ✅ 全 200 + 后 4 次 < 1 秒 → 服务活跃、保活有效
- ⚠️ 每次都 30+ 秒 → 已冷启动，保活失效
- ❌ 404 → URL 错误（确认是 `feiyue-credit.onrender.com` 不是 `feiyue-credit-system.onrender.com`）

---

## 📌 当前生效版本

- 保活 URL: **`https://feiyue-credit.onrender.com/api/health`** ✅ 已确认 200
- Render 服务状态: Running (Free plan) ✅
- 最近一次部署: commit `f128059` ✅