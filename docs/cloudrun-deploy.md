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

> ⚠ 数据库文件 `server/data/credit.db` 不会被打进镜像（也不应打进），见第五节。

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

## 五、数据库持久化（⚠ 唯一真障碍，需决策）

云托管**容器不支持持久化存储**，现有 `node:sqlite` 文件库（`data/credit.db`）在容器重启/缩容时会**丢失**。二选一：

### 方案 A：临时态 sqlite（MVP 快上线）
- 云托管「服务设置」→ 实例副本数最小值设为 **1**（单实例常驻，降低重启概率）。
- 加一个定时任务（云托管「定时触发器」或容器内 cron）把 `data/credit.db` 备份到**对象存储 COS**。
- 启动时若检测到库文件不存在，从 COS 拉回最近备份。
- **优点**：零代码改动，半天可上线。
- **缺点**：容器被平台调度重启且备份间隔内的数据会丢；不适合长期生产。

### 方案 B：迁移腾讯云数据库 MySQL（生产稳健）
- 新建 **TencentDB for MySQL**（基础版，按量很低），记下连接串。
- 把 `server/src/db.js` 的 `node:sqlite` 换成 `mysql2`：
  - `DatabaseSync` → `mysql2/promise` 连接池
  - SQL 方言调整：`AUTOINCREMENT`→`AUTO_INCREMENT`、`datetime('now')`→`NOW()`/`CURRENT_TIMESTAMP`、`last_insert_rowid()`→`LAST_INSERT_ID()`、去掉 `PRAGMA`、WAL 相关配置删除
  - `db.prepare(...).get()/.run()/.all()` → `await pool.query(...)`（Promise 化，route 层需 `async/await`）
- 各 route 文件的查询同步改异步（工作量中等，约 10 个文件）。
- 环境变量注入 `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME`（云托管环境变量配置，不写进镜像）。
- **优点**：真正持久、可随流量扩缩容。
- **缺点**：需做一次 DB 层重写。

> 本仓库当前代码仍是 `node:sqlite`。**上线前必须先选 A 或 B**，否则数据会丢。

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
