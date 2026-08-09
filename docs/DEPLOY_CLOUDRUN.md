# 微信云托管 · 一键部署总览（专业版）

> 本文件把「配置 → 部署 → 联调」4 步串成一份可直接执行的 runbook。
> 本地能自动化的已由工具完成，控制台操作已最小化到「粘贴 + 2 次点击」。

---

## 已为你自动完成的（无需你操作）

| 项 | 文件 | 说明 |
|----|------|------|
| ✅ 小程序切生产 | `miniprogram/config/env.js` `IS_PROD=true` | 已切，自动走云托管 callContainer |
| ✅ 双命名兼容 | `server/src/db.js` `resolveDbConfig()` | 控制台 `MYSQL_*` 与代码 `DB_*` 都能读 |
| ✅ 本地环境变量 | `server/.env` | 本地/Docker 直跑用，已被 gitignore 忽略 |
| ✅ 批量导入文件 | `docs/cloudrun-env.json` | 控制台一键导入 11 条变量 |
| ✅ 代码包 | `dist/server-cloudrun.zip` | 420 文件，package.json 在根，可直接上传 |
| ✅ 打包脚本 | `tools/package_server.py` | 重新打包：`python tools/package_server.py` |
| ✅ 逻辑验证 | `db.js` resolveDbConfig 三场景测试通过 | MYSQL_*/DB_*/缺省 全部正确 |
| ✅ 自动建库 | `server/src/db.js` `ensureDatabase()` | 启动自动 `CREATE DATABASE IF NOT EXISTS credit`，**无需手动建库**（已部署验证修复 Unknown database 报错） |

---

## 第一步：导入环境变量（控制台 · 约 30 秒）

1. 打开 `mp.weixin.qq.com` → 左侧「开发」→「云托管」
2. 点服务 **express-fzw2** →「服务设置」→「环境变量」
3. 若页面有「导入 JSON」按钮 → 上传 `docs/cloudrun-env.json`，跳过下面手动步骤
4. 若无导入按钮，按以下 11 条逐条「新增」（值已填好，原样复制）：

```
NODE_ENV=production
WX_APP_ID=wx0fe78d74fdc47c1b
WX_APP_SECRET=ce5289a2b7ebd51a2d86a45fe83cb0f8
JWT_SECRET=283edceb3774a3230c225574ae379d8d334aa155994713d3732f26fe75c1207f
DB_HOST=10.18.108.46
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Xpm8swMt
DB_NAME=credit
INIT_POINTS=100
RESOURCE_VIEW_COST=5
```

> ⚠️ 控制台已有的 `MYSQL_ADDRESS` / `MYSQL_USERNAME` / `MYSQL_PASSWORD` / `COS_*` **保留不动**。

---

## 第二步：上传代码包并重新部署（控制台 · 约 2-5 分钟）

1. 同服务 →「版本管理」→「新建版本」
2. 上传方式选「**代码包**」→ 选 `dist/server-cloudrun.zip`
3. 确认「服务端口」为 `80`（Dockerfile 已内置）
4. 点「确认」→ 等待构建（状态：构建中 → 部署中 → **运行中**）
5. ⚠️ 这一步同时让第一步的环境变量生效——**只保存不重建 = 不生效**

---

## 第三步：健康检查（控制台 · 1 分钟）

部署完成后：

1. 点「服务设置」复制**公网域名**：
   `https://express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com`
2. 浏览器打开：
   `https://express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com/api/health`
3. 返回 `{"status":"ok",...}` 即后端已连上数据库并正常启动 ✅
4. 若返回 502/504 → 看「日志」面板，常见是 `MYSQL_*` 连不上或 `JWT_SECRET` 缺失

---

## 第四步：小程序联调（开发者工具 · 本地）

> `env.js` 的 `IS_PROD` 已为你改成 `true`，无需再改。

1. 微信开发者工具打开 `miniprogram/` 目录（AppID 自动识别 `wx0fe78d74fdc47c1b`）
2. 点「编译」
3. 用测试账号登录：
   - 账号：`student01`
   - 密码：`123456`
4. 验证：能登录、能看资料列表、能查积分 → 全部正常即联调通过 ✅
5. 上传代码（生成体验版）→ 加体验成员 → 提审 → 过审发布

---

## 故障速查

| 现象 | 原因 | 处理 |
|------|------|------|
| 接口全部 404 | `X-WX-SERVICE` 头错/服务名错 | 核对 `env.js` 的 `CLOUD_RUN_SERVICE` = `express-fzw2` |
| 启动 FATAL: JWT_SECRET 缺失 | 环境变量没重建 | 回到第一步重新部署 |
| ECONNREFUSED 10.18.108.46 | MySQL 内网不通 | 确认云托管与 MySQL 同地域同 VPC |
| Access denied for root | 密码错 | 核对 `DB_PASSWORD` = `Xpm8swMt` |
| 微信登录失败 | AppSecret 错/测试号 | 用正式 AppID + 真实 AppSecret |

---

## 重新打包（改了后端代码后）

```bash
python tools/package_server.py
# 产物：dist/server-cloudrun.zip → 回到第二步重新上传部署
```
