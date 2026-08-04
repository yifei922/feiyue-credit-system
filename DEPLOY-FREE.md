# 免费部署真实多人系统（Node 全栈 + SQLite）

> 目标：不用买服务器、不用买域名，把「真·多人持久系统」部署到免费平台，全班即可公网访问。
> 后端 = Node(Express) + 内置 `node:sqlite`（真文件数据库，零运维）；前端 = 已构建的静态站点，由 Node 同源托管。**单进程全栈，部署只需一条命令。**

---

## 一、在你自己电脑本地先跑通（0 成本，验证用）

前置：安装 Node.js 18+。

```bash
# 1) 构建前端（连真实后端模式）
cd frontend
npm install
npm run build --mode server      # 产出 frontend/dist，API 走同源 /api

# 2) 启动后端（自动托管 frontend/dist + 提供 /api）
cd ../server
npm install
npm start                        # 默认 http://localhost:3001
```

浏览器打开 http://localhost:3001 即可。首启动自动建库并写入演示数据。

初始账号（密码均为 `123456`）：

| 角色 | 用户名 | 权限 |
|------|--------|------|
| 管理员(老师) | `admin` / `teacher01` | 全部：导入名单、管理课程/任务/学分、查看一切 |
| 课代表 | `rep01`(语文) / `rep02`(数学) | 仅能安排**自己负责的科目**，查看该科目数据 |
| 学生 | `stu01`~`stu06` | 仅查看本人数据、完成登记本人、接收推荐 |

> 名单导入：管理员在「学生端」页点「导入名单」，粘贴 CSV（`姓名,学号` 每行一条）即可批量建学生并自动生成账号（默认密码 123456）。

---

## 二、免费公网部署（推荐 Render，无需服务器/域名）

Render 免费层会分配 `*.onrender.com` 子域名，自动 HTTPS，绑定 GitHub 后推送即部署。

### 1. 准备 GitHub 仓库
```bash
git init
git add .
git commit -m "feiyue credit system"
# 在 GitHub 新建仓库后：
git remote add origin <你的仓库地址>
git push -u origin main
```

### 2. Render 一键部署
1. 登录 https://render.com （用 GitHub 授权，免费）
2. New → **Web Service** → 关联你的仓库
3. 选择 **"Use render.yaml"**（仓库根目录已提供 `render.yaml`）
4. 免费层（Free）直接 Create
5. 等待构建完成，Render 分配公网网址，例如 `https://feiyue-credit.onrender.com`

`render.yaml` 已配置：构建时自动 `npm install` 前端并 `build --mode server`，再安装并启动后端；`JWT_SECRET` 自动生成。

### 替代：Koyeb 免费层
Koyeb 同样提供免费 Web 服务 + 自动 HTTPS。流程类似：关联 GitHub 仓库，构建命令填
`cd frontend && npm install && npm run build --mode server && cd ../server && npm install`，
运行命令填 `cd server && npm start`，暴露端口 `3001`。

---

## 三、重要说明（持久化）

- **SQLite 文件数据库**位于 `server/data/credit.db`，数据真实持久（多人同时读写）。
- Render **免费层文件系统是临时性的**：每次重新部署/休眠唤醒可能重置文件系统中的 `credit.db`。
  - 临时演示：可接受，重部署后数据回到种子状态。
  - 想要**长期稳定持久**：在 Render 绑定一个 **Render Disk**（付费，约 $0.1/GB·月）挂载到 `/data`，并把环境变量 `DB_PATH=/data/credit.db`；或后续把存储换成 Render 免费 Postgres（90 天免费额度）。需要我改造成 Postgres 版可随时提出。

---

## 四、与其他方案的对比

| 方案 | 服务器/域名 | 多人持久 | 成本 | 适用 |
|------|-----------|---------|------|------|
| CloudStudio 静态(Mock) | 不需要 | ❌ 演示数据 | 免费 | 仅演示界面 |
| **本文 Node + 免费平台** | 不需要 | ✅ SQLite 文件 | 免费 | **真多人、最省钱** |
| docker-compose 自托管 | 需要 | ✅ MySQL | 服务器费用 | 自有服务器/内网 |
