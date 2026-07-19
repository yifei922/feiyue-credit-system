# 斐越十班 · 班级作业学分管理系统 V2.0（网页端）

基于 **Vue 3 + Vite + Element Plus + Pinia** 与 **Spring Boot 3 + MyBatis-Plus + Spring Security 6 + JWT** 的
前后端分离班级作业学分管理系统。

> 当前进度：
> - **阶段一（指令 1–2）** 骨架 + 数据库已完成，登录链路可端到端跑通。
> - **阶段二（指令 3–5）** 积分流水 / 预警推荐 / 动态数据看板 已实现。
> - **阶段三（指令 6–7）** 操作日志查询页 + 全局快捷键（Ctrl+S/Ctrl+A）+ 模板/拖拽已完成。
> - **阶段四（指令 8–9）** 自动化测试（Vitest 18 例全过，核心逻辑覆盖率 93%）/ Docker 一键编排已完成。
>   - 前端：可经 **Mock 模式** 直接演示（无需后端）；`npm test` 可跑测试。
>   - 后端：Spring Boot 代码已交付（含 JUnit 测试与 Dockerfile），需在 Java 17+ 环境编译运行。

## 关于「index.html 打不开」

本项目是 **Vite 工程**，`index.html` 中的 `<script type="module" src="/src/main.js">` 是开发服务器路径，
**不能**直接双击用 `file://` 打开（会白屏）。正确方式：

```bash
cd frontend && npm install && npm run dev
# 浏览器访问 http://localhost:5173
```

## 前端 Mock 模式（无后端也能看效果）

本沙箱无 Java 运行时，后端无法启动。前端内置 `src/api/mock.js` 模拟数据层：

- `frontend/.env` 中 `VITE_USE_MOCK=true` → 所有 API 返回本地模拟数据，页面（积分流水 / 预警 / 推荐 / 看板）立即可用。
- 接上真实 Spring Boot 后端后，将该变量改为 `false`，并 `npm run dev` 即可切换为真实接口。

> 演示账号：teacher01 / rep01 / admin，口令均为 `123456`（由后端 `DataInitializer` 初始化）。

## 目录结构

```
.
├── db/schema.sql          # 数据库初始化（10 张表 + 索引 + 种子数据）
├── backend/               # Spring Boot 3 后端
├── frontend/              # Vue 3 前端
└── docs/design-and-plan.md# 架构设计 / API 契约 / 分阶段计划
```

## 1. 初始化数据库

```bash
mysql -u root -p
CREATE DATABASE credit_db CHARACTER SET utf8mb4;
USE credit_db;
SOURCE db/schema.sql;
```

## 2. 启动后端（需 Java 17+ 与 Maven）

```bash
cd backend
mvn spring-boot:run
# 默认端口 8080，上下文路径 /api
# Swagger 文档： http://localhost:8080/api/swagger-ui.html
```

环境变量（可选覆盖）：

| 变量 | 说明 | 默认 |
|------|------|------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | 数据库连接 | localhost / 3306 / credit_db / root / root |
| `JWT_SECRET` | JWT 签名密钥（≥32 字符，**生产必改**） | 内置占位值 |
| `CORS_ORIGINS` | 允许的前端源 | http://localhost:5173,http://localhost:80 |

启动后自动创建默认账号（口令均为 `123456`，上线前请修改）：`teacher01`(教师) / `rep01`(科代表) / `admin`(管理员) / `student01`(学生，对应学生「张三」)。

> **角色化体验**：学生登录后进入「学生端」并默认展示本人学分/流水/推荐；教师与管理员进入「数据看板」，菜单含任务管理、完成登记、预警中心、系统设置等管理模块（学生不可见）。

## 3. 启动前端

```bash
cd frontend
npm install
npm run dev
# 默认 http://localhost:5173 ，已配置 /api 代理到后端 8080
```

打开浏览器访问 `http://localhost:5173`，使用上述账号登录即可进入「数据看板」。

> **最稳的预览方式（沙箱/隔离环境适用）**
> 沙箱与桌面客户端网络隔离，`http://localhost:5173` 这类 localhost 隧道在后台服务被回收后会报「网络错误」。
> 推荐以**本地静态文件**方式查看，预览面板在沙箱侧渲染、不依赖隧道：
> ```bash
> cd frontend && npm run build      # 产物在 dist/，已配置 base:'./' 相对路径
> # 直接用 WorkBuddy 打开 frontend/dist/index.html（本地文件预览，必能加载）
> ```
> 路由已改为 **hash 模式**，静态文件下刷新任意子页面也不会 404。改动代码后重新 `npm run build` 再打开即可看到最新效果。
> 若需带热更新的开发模式：`npm run dev`（端口 5173，长时间挂机可能被回收，属正常）。

## 4. 验证登录链路（指令 1 评估标准）

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"teacher01","password":"123456"}'
# 返回 code=0 且包含 token 即表示成功
```

## 5. 前端功能地图（导航菜单）

| 菜单 | 对应指令 | 说明 |
|------|----------|------|
| 数据看板 | 指令5 | ECharts 柱状/饼/折线，点击下钻 |
| 任务管理 | 指令7 | 新建任务、**存为模板 / 从模板创建** |
| 完成登记 | 指令3/7 | **vuedraggable 拖拽**选择学生 + **Ctrl+S** 保存 / **Ctrl+A** 全选 |
| 学生端 | 指令3/4 | 积分流水标签页 + 推荐任务标签页 |
| 预警中心 | 指令4 | 预警列表、手动扫描、标记解决 |
| 系统设置 | 指令6 | **操作日志查询**（按操作人/类型/时间筛选，查看前后快照） |

## 6. 自动化测试（指令 8）

```bash
cd frontend
npm test          # 监听模式
npm run test:run  # 单次运行
npm run coverage  # 覆盖率（核心逻辑 utils + mock 达到 93% 行覆盖）
```

测试覆盖：学分计算（按时/逾期/未完成/向下取整）、Mock 数据层（登记→流水→总学分、推荐、看板、下钻、操作日志筛选）、以及 Vue Testing Library 组件集成。
后端 JUnit 测试位于 `backend/src/test`（CompletionService 学分逻辑、AlertService 扫描、SecurityUtils 行级隔离），需在 Java 17+ 用 `mvn test` 运行。

## 7. 生产部署（方案 B · Docker 全栈）

> 要实现**多人同时在线、数据持久化**，走容器化全栈部署。完整手册见 **[DEPLOY.md](./DEPLOY.md)**。

最简一键部署（在装有 Docker 的 Linux 服务器上）：

```bash
chmod +x deploy.sh
./deploy.sh          # 自动生成随机 JWT_SECRET 与数据库密码，构建并启动
# 访问 http://<服务器IP>:8080
```

编排包含 3 个服务：`mysql`（自动执行 db/schema.sql 初始化）、`backend`（Spring Boot，多阶段 Maven 构建）、`frontend`（Nginx 托管 dist 并反向代理 `/api` 到后端）。
关键文件：`docker-compose.yml`、`frontend/Dockerfile`、`frontend/nginx.conf`（注意 `proxy_pass` 末尾不带 `/` 以保留 `/api` 前缀）、`backend/Dockerfile`、`deploy.sh`、`.env.example`。

生产必做：① 绑定域名 + HTTPS（见 DEPLOY.md §4）；② 修改默认账号口令、强密码、随机 JWT_SECRET（`./deploy.sh` 已自动随机生成）；③ 定期备份 MySQL（DEPLOY.md §5）。

> 说明：本沙箱无 Java 与 Docker，后端与容器编排无法在此运行验证，已作为交付物提供，请在你本地 Java 17+ / Docker 环境或云服务器执行。

## 8. 真·多人持久系统（免费，无需服务器/域名）

想要**真实多人同时在线、数据存数据库、管理员导入名单、老师/课代表按科目安排课程与学分**，且**不买服务器、不买域名** → 用新增的 **Node 全栈后端**（`server/`）配合免费平台部署。

- **后端** `server/`：Node + 内置 `node:sqlite` 真文件数据库 + Express + JWT + RBAC（管理员/课代表/学生三角色 + 课代表科目范围隔离）。已在本环境**完整跑通并验证**：登录、CSV 名单导入、课代表仅能安排自己负责科目（越权 403）、学生仅看本人、完成登记实时重算学分、看板/预警/操作日志全链路。
- **前端**：`npm run build --mode server` 构建为连真实后端版本，由 Node 同源托管（单进程全栈）。
- **免费部署**（Render / Koyeb 免费层，自动分配 `*.onrender.com` 子域名、HTTPS）：详见 **[DEPLOY-FREE.md](./DEPLOY-FREE.md)**，仓库根已含 `render.yaml` 一键部署。

初始账号（密码均为 `123456`，上线前请修改）：`admin` / `teacher01`（管理员·老师）、`rep01`（语文课代）/ `rep02`（数学课代）、`stu01`~`stu06`（学生）。
**管理员可在「学生端」页导入 CSV 名单，批量建学生并自动生成账号**；课代表仅能安排自己负责科目的任务与学分。

> 说明：Spring Boot 后端（`backend/`）仍作为原方案交付物保留；Node 后端是为「无服务器、最免费、可立即验证」而落地的可运行实现。
