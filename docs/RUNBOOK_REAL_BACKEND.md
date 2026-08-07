# 真实后端 + 数据库 核验 Runbook

> 目标：在本机（或服务器）用 **真实 MySQL + 真实 Node 后端** 把「30 人不同角色」矩阵完整跑一遍，
> 核验各功能模块的**可用性**与**稳定性**（含并发一致性）。
> 沙箱环境（无 Docker / 无 MySQL）无法代跑，请按本指南在你自己的机器上执行。

---

## 一、前置条件

- 已安装 Docker Desktop（Windows / macOS）或 Docker Engine（Linux）。
- 本仓库根目录已有 `docker-compose.yml`（已修正为 MySQL + backend + frontend 一体化编排）。
- Node ≥ 18（仅用于跑核验脚本 `tools/verify_real_backend.js`）。

## 二、一键拉起真实后端 + 数据库

```bash
# 1) （可选）按需覆盖默认口令 / JWT 密钥
#    复制 .env 并修改 DB_PASSWORD / JWT_SECRET / WX_APP_ID / WX_APP_SECRET
cp .env .env.local        # 实际直接用根目录 .env 即可，compose 已设默认值

# 2) 启动 MySQL + 后端 + 前端（首次会构建镜像，稍慢）
docker compose up -d --build

# 3) 观察后端是否完成「建表 + 种子」
docker compose logs -f backend
# 看到 "server listen on 8080" / "seed done" 之类即就绪
```

启动完成后：
- 前端： http://localhost:8080
- 后端直连（核验脚本用）： http://localhost:3001
- MySQL： 127.0.0.1:3306 （root / `feiyue_dev_pwd`，库名 `credit`）

> 后端启动时会自动 `db.init()`（建表/迁移）+ `seed()`（注入 admin / teacher01 / rep01 / rep02 / student01… 等种子账号，密码统一 `123456`；`superadmin` 密码 `Feiyue@2026`）。

## 三、跑 30 人矩阵核验

```bash
# 默认打 http://localhost:3001；可用环境变量覆盖
#   API_BASE=http://localhost:3001 ADMIN_USER=admin ADMIN_PWD=123456 \
node tools/verify_real_backend.js
```

脚本会：
1. 用 `admin / 123456` 登录，拉取全部账号，组建 **30 人花名册**（2 ADMIN / 4 TEACHER / 8 REP / 16 STUDENT；种子不足时取实际数量并在结尾提示）。
2. 按角色执行真实接口：登录、浏览、建任务、列学生/科目/资料/流水、设课代表、改角色、重置密码、看预警/日志、课代表登记作业完成。
3. **并发压测**：对**同一学生**并发 30 次 `POST /api/credit-flow/adjust`（每次 +1），验证「原子增量」修复后总分 = 初始 + 30（无丢失更新）。
4. 校验列表分页响应头 `X-Total-Count` / `X-Has-More`。
5. 输出模块通过率、接口耗时 P95、并发一致性结论，并写 `tools/verify_result.json`。

退出码：`0` 全部通过；`1` 有失败；`2` 后端未就绪；`3` 脚本异常。

## 四、预期结果

- 模块可用率 **100%**（与契约模拟 `tools/sim_30users.js` 的 568/568 一致）。
- 并发压测：**无丢失更新**（终值 == 初始 + 30），证明 #4 原子增量修复在真实并发下有效。
- 接口 P95 通常在数十~数百毫秒（本地 Docker 网络），无超时即稳定性达标。

## 五、不依赖 MySQL 的离线自检（沙箱可用）

无法起 Docker 时，仍可运行纯逻辑证明，确认核心修复的正确性：

```bash
node tools/verify_credit_logic.js
```

它离线证明两件事：
- #4 旧「读 SUM→覆盖写」在并发下会丢更新；新「单条原子 `UPDATE total=total+?`」不会。
- #7 分页切片 + `X-Has-More` 计算正确，且主体仍为数组（网页端兼容）。

## 六、常见问题

| 现象 | 排查 |
|------|------|
| `管理员登录失败 ... ECONNREFUSED` | 后端未起好；`docker compose ps` 看 backend 状态，`docker compose logs backend` |
| `mysqladmin ping` 一直重试 | 首次启动 MySQL 初始化较慢，等待 healthcheck 通过；确认 3306 端口未被占用 |
| 花名册不足 30 人 | 种子默认账号有限；可在网页端补建账号，或扩展 `server/src/db.js` 的 `studentsSeed` 后 `docker compose down -v && docker compose up -d --build` |
| 并发压测终值 ≠ 期望 | 说明原子修复未生效；检查 `server/src/routes/creditFlow.js` / `completions.js` 是否已改为 `total=total+?` |
