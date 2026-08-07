# 微信云托管部署手册（点滴进步 · 小程序后端）

> 目标：把现有 Node 后端跑在**微信云托管**，小程序用 `wx.callContainer` 调用，**免域名、免 ICP 备案**。
> 网络端 feiyue-credit.onrender.com 保持不变，互不影响。

---

## 一、为什么选云托管

- 小程序用 `wx.callContainer` 调用云托管服务 → **无需在 mp 后台配置 request合法域名，也无需 ICP 备案**（官方文档确认）。
- 直接绕开"onrender 是海外节点无法备案"的死结。
- 现有 Express 服务**打包成容器即可运行**，代码改动极小（本仓库已完成调用层切换）。

---

## 二、前置准备

1. 微信公众平台 → 左侧「云托管」→ 开通，得到：
   - **环境 ID**（填进 `miniprogram/config/env.js` 的 `CLOUD_RUN_ENV`）
   - **默认公网域名**（形如 `xxxx.ap-shanghai.run.tcloudbase.com`，填进 `CLOUD_RUN_PUBLIC_HOST`）
2. 在「服务设置」里记一下**服务端口**（默认 80，与 Dockerfile `EXPOSE 80` 对应）。

---

## 三、后端 Docker 化（已完成）

仓库已含：
- `server/Dockerfile`（基于 `node:22-slim`，`npm install --omit=dev`，监听 `process.env.PORT`）
- `server/.dockerignore`（排除 node_modules / data / .env）

> ⚠ 后端已不依赖文件型数据库（`node:sqlite` 已迁移到外部 MySQL，见第五节），`server/.dockerignore` 仍排除 `.env` / `data` 等本地产物，避免泄露凭证。

---

## 四、构建与部署镜像

**方式一：云托管控制台拉取代码构建（推荐，无需本地装 Docker）**
1. 云托管 → 新建服务 → 选择「代码仓库」或「本地代码包」上传 `server/` 目录。
2. 平台按 Dockerfile 自动构建。
3. 部署后，在「服务设置」把「实例副本数最小值」按需要设置（见数据库章节）。

**方式二：本地构建推送 TCR**
```bash
cd server
docker build -t your-tcr/feiyue-credit-server:latest .
docker push your-tcr/feiyue-credit-server:latest
# 在云托管控制台「镜像部署」填入该镜像地址
```

---

## 五、数据库持久化（✅ 已选定方案 B：腾讯云 MySQL，代码已完成迁移）

云托管**容器不支持持久化存储**，不能再用文件型 sqlite。本仓库已**完成迁移到 MySQL**（通过 `mysql2/promise` 连接池 + 兼容 shim，上层代码仅需在调用处加 `await`）：

- `server/src/db.js`：`node:sqlite DatabaseSync` → `mysql2/promise` 连接池；提供 `db.prepare().get/run/all` + `db.exec/query/close` 的兼容 shim，返回结构与原先一致（`get`→row，`run`→`{lastInsertRowid, changes}`，`all`→rows[]）。
- SQL 方言已调整：`INTEGER PRIMARY KEY AUTOINCREMENT`→`INT PRIMARY KEY AUTO_INCREMENT`、`datetime('now')`→`CURRENT_TIMESTAMP`、去除 `PRAGMA`/WAL、索引内联到建表语句。
- 所有 route / service / middleware 的查询已转 `async/await`（`forEach`+`await` 改为 `for…of`，`.map(async)`/`Promise.all` 已规范化，`rbac` 同步辅助函数改为 `await` 调用）。
- `server/src/index.js`：启动时用 `await db.init()` 在建表 + 种子 + 迁移完成后才 `app.listen`，DB 不可达会中止启动。
- `server/package.json` 已加入 `mysql2` 依赖。

### 数据库连接配置（环境变量，不写进镜像）
复制 `server/.env.example` 为 `server/.env`（本地）/ 在云托管「环境变量」中注入：

| 变量 | 说明 |
|------|------|
| `DB_HOST` | 腾讯云 MySQL 内网/外网地址（本地 compose 用 `db`） |
| `DB_PORT` | 默认 3306 |
| `DB_USER` | 默认 root |
| `DB_PASSWORD` | 实例密码 |
| `DB_NAME` | 库名，默认 `credit` |
| `DB_SSL` | 公网连接建议 `1`（内网可省略） |
| `DB_POOL_SIZE` | 连接池大小，默认 10 |

> 首次启动 `init()` 会自动 `CREATE TABLE IF NOT EXISTS` + 种子数据 + 幂等迁移（补齐科目、超级管理员、微信登录字段等），无需手动建库。

### 本地无腾讯云账号也能验证
`server/docker-compose.yml` 一键起 **MySQL 8 + 后端**：
```bash
cd server
docker compose up --build      # 访问 http://localhost:8080
docker compose down -v         # 停止并清空数据，下次重新 seed
```
compose 内 `app` 已注入 `DB_HOST=db` 等变量，并 `depends_on: db.service_healthy`，确保库就绪后再启动后端。

> ⚠ 仍走临时态 sqlite（方案 A）亦可，但本仓库代码已不再支持文件库，必须接外部 MySQL。

---

## 六、小程序侧配置（已完成调用层，只差填值）

编辑 `miniprogram/config/env.js`：
```js
const IS_PROD = true;
const PROD = {
  USE_CLOUD_RUN: true,
  CLOUD_RUN_ENV: '你的环境ID',            // 第二步拿到
  CLOUD_RUN_PUBLIC_HOST: 'xxxx.ap-shanghai.run.tcloudbase.com', // 第二步拿到
};
```
- `app.js` 的 `_api` 会自动改用 `wx.callContainer`（无需改其他调用代码）。
- 文件上传（`submit.js` / `profile.js`）与静态资源（`resource-detail.js`）自动改用默认公网域名。
- **无需**在 mp 后台配置 request合法域名（callContainer 走微信私有协议）。

---

## 七、联调与审核

1. 微信开发者工具 → 编译，确认 `IS_PROD=true` 下能登录（student01 / 123456）、刷动态、看资料。
2. 提交审核时测试账号填 **student01 / 123456**（同学视角，不暴露管理端）。
3. 审核通过 → 小程序备案 → 发布。

---

## 八、已知限制 & 生产建议

- **文件上传 / 静态资源**当前走云托管**默认公网域名**，官方建议仅用于测试。生产建议：
  - 绑定一个**已备案自定义域名**（需另购服务器做备案主体，见对比文档方案 B），或
  - 小程序**直传 COS**，后端只存 URL（最稳，改动中等）。
- 默认公网域名有性能/频率限制，正式放量前务必处理。
- 数据库务必按第五节选 A 或 B，不可裸跑临时态。

---

## 九、与网络端（onrender）的关系

- 网络端继续用 onrender 上海外节点、保留"洛一高附中+学分"运营规则，独立运行。
- 小程序后端独立部署在云托管，**数据默认不与网络端共享**（如需共享，云托管绑备案域名后网络端也可调用，或两者各用各的库）。
- 两者审核与备案完全隔离，互不影响。
