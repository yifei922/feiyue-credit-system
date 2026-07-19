# 斐越·十班班级作业学分管理系统 V2.0（网页端）
## 架构设计 · 数据库 Schema · API 契约 · 分阶段实施计划

> 状态：**方案评审稿（Plan & Schema）** —— 本阶段仅产出设计、数据库 DDL 与 API 契约，不编写业务代码。
> 后端技术栈（Spring Boot 3 + MyBatis-Plus）按约定将在你本地的 Java 17+ 环境中编译运行；本沙箱仅校验前端与 SQL。

---

## 1. 项目目标与范围

基于既有设计方案，优化并交付一个**前后端分离**的网页版班级作业学分管理系统，覆盖：

- 作业/背书任务的发布、完成情况登记与学分计算；
- 积分流水追溯、学分预警与个性化推荐；
- 动态数据看板（ECharts）；
- 细粒度权限（行级 class_id 隔离）与操作审计；
- 模板化、拖拽、快捷键等交互优化；
- 自动化测试 + Docker 一键部署。

### 9 条指令 → 阶段映射
| 阶段 | 指令 | 主题 |
|------|------|------|
| 一 | 指令1 | 前后端分离项目骨架（Vue3 / Spring Boot3） |
| 一 | 指令2 | 数据库设计与初始化（索引/字段优化） |
| 二 | 指令3 | 积分激励与流水记录 |
| 二 | 指令4 | 智能预警与个性化推荐 |
| 二 | 指令5 | 动态可视化数据看板 |
| 三 | 指令6 | 细粒度权限与审计日志 |
| 三 | 指令7 | 用户体验与交互细节（模板/拖拽/快捷键） |
| 四 | 指令8 | 自动化测试用例（JUnit / Vitest） |
| 四 | 指令9 | Docker 化部署与文档 |

---

## 2. 技术栈

| 层 | 选型 |
|----|------|
| 前端框架 | Vue 3 (`<script setup>`) + Vite |
| 前端路由/状态 | Vue Router 4 + Pinia |
| UI 组件 | Element Plus（表格/表单/标签/对话框成熟稳定） |
| 图表 | ECharts 5 |
| HTTP | Axios（统一拦截器） |
| 拖拽 | vuedraggable 4（基于 SortableJS） |
| 后端 | Spring Boot 3.x（Java 17） |
| ORM | MyBatis-Plus 3.5+ |
| 安全 | Spring Security 6 + JWT |
| 文档 | SpringDoc OpenAPI 3（Swagger UI） |
| 数据库 | MySQL 8.0 |
| 调度 | Spring Scheduler（`@Scheduled` 凌晨扫描预警） |
| 测试 | 后端 JUnit 5 + Mockito；前端 Vitest + Testing Library |
| 部署 | Docker + docker-compose（前端 Nginx / 后端 Jar / MySQL） |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Vue 3 SPA)                  │
│  Views: 登录 / 任务管理 / 完成登记 / 学生端 / 预警中心 /       │
│         数据看板 / 推荐任务 / 积分流水 / 系统设置 / 操作日志    │
│  Pinia stores · Vue Router · Axios(interceptor: JWT+错误码)   │
└───────────────┬───────────────────────────┬─────────────────┘
                │  HTTPS / JSON              │
                ▼                            │
        ┌───────────────┐            ┌───────────────┐
        │  Nginx (静态) │            │  Nginx (反代) │
        └───────────────┘            └───────┬───────┘
                                             ▼
                                  ┌───────────────────────┐
                                  │   Spring Boot 3       │
                                  │  ├ AuthFilter(JWT)    │
                                  │  ├ Controllers        │
                                  │  ├ Services (业务)    │
                                  │  ├ Security(行级权限) │
                                  │  ├ Scheduler(预警)    │
                                  │  └ MyBatis-Plus       │
                                  └───────────┬───────────┘
                                             ▼
                                     ┌───────────────┐
                                     │   MySQL 8.0   │
                                     └───────────────┘
                                  Swagger UI: /swagger-ui.html
```

**关键设计点**
- **Axios 拦截器**：请求头统一注入 `Authorization: Bearer <JWT>`；响应拦截统一处理业务错误码（`401` 跳登录、`403` 权限提示、`BUSINESS_xxx` 弹错）。
- **行级权限**：教师/科代表请求在 Service 层自动追加 `class_id = ?`（取自已登录用户的 `class_id`），保证教师 A 看不到教师 B 班级数据。
- **学分一致性**：完成登记 → 写 `completion_record` + 写 `credit_flow` + 更新 `student.total_credits`，三者在同一事务内完成。

---

## 4. 目录结构（规划）

```
credit-system/
├── backend/                      # Spring Boot 3
│   ├── src/main/java/com/feiyue/credit/
│   │   ├── config/               # Security, JWT, MyBatis, Swagger, WebMvc
│   │   ├── controller/           # auth/student/task/completion/creditFlow/alert/dashboard/log
│   │   ├── service/  impl/
│   │   ├── mapper/               # MyBatis-Plus Mapper
│   │   ├── entity/               # 与下表一一对应
│   │   ├── dto/ vo/              # 请求/响应对象
│   │   ├── security/             # JWT 工具、UserDetails、权限切面
│   │   ├── schedule/             # 预警定时任务
│   │   └── common/               # Result 包装、异常、注解
│   ├── src/main/resources/       # application.yml, mapper xml
│   └── pom.xml
├── frontend/                     # Vue 3 + Vite
│   ├── src/
│   │   ├── api/                  # 按模块封装 axios 调用
│   │   ├── stores/               # Pinia: auth, task, student...
│   │   ├── router/  views/  components/
│   │   ├── utils/request.js      # Axios 拦截器
│   │   └── composables/          # useShortcut / useDragSelect
│   └── package.json
├── db/schema.sql                 # 本仓库已提供
├── docker-compose.yml
├── backend/Dockerfile  frontend/Dockerfile
└── README.md
```

---

## 5. 数据库设计（要点）

完整 DDL 见 `db/schema.sql`。核心表与评估标准落实：

| 表 | 关键字段 | 索引/优化 |
|----|----------|-----------|
| `class` | id, name, grade | PK |
| `subject` | id, name, teacher_id, class_id | `idx_subject_class(class_id)` |
| `sys_user` | username, password(BCrypt), role, class_id | `uk_username` |
| `student` | **total_credits（累计总学分，新增）** | `uk_student_no(no,class)` |
| `task` | subject_id, class_id, type, credit_value, deadline, template_id | **复合索引 `idx_task_subject_class(subject_id, class_id)`** |
| `completion_record` | **completion_time（datetime，新增）**, status, credit_change, operator_id | **复合索引 `idx_cr_subject_student(subject_id, student_id)`**；`uk_task_student` 唯一 |
| `credit_flow` | **(新增) user_id, task_id, credit_change, flow_type** | `idx_flow_user`, `idx_flow_task` |
| `task_template` | name, subject_id, type, credit_value | — |
| `alert` | student_id, class_id, type, reason, status | `idx_alert_class/student` |
| `operate_log` | operator*, operate_type, table_name, record_id, **before/after_snapshot(JSON)** | `idx_log_*` |

> **关于「任务表 (科目ID,学生ID) 复合索引」的说明（需你确认）**
> 现有设计把「任务」定为**班级级**（一个任务发给全班），因此任务表不含 `student_id`，(科目ID,学生ID) 索引落在 `completion_record` 上最合理，任务表改为 `(subject_id, class_id)`。
> 若贵方原始方案里**任务本就是「每名学生一行」**（task 含 student_id），请告知，我会在实现阶段把任务表索引改为 `(subject_id, student_id)`，并在 `task` 增加 `student_id` 字段。

**高效联合查询示例（见 schema.sql 末尾）**：学生×科目完成情况、班级×科目任务列表、学生积分流水，均命中对应复合索引。

---

## 6. API 契约（按模块）

> 统一响应：`{ "code": 0, "msg": "ok", "data": ... }`，`code != 0` 视为业务错误。
> 鉴权：除 `/api/auth/login` 外，所有接口需 `Authorization: Bearer <JWT>`。
> 行级权限：带 `classId` 的查询后端强制以登录用户 `class_id` 过滤（教师/科代表）。

### 6.1 认证 Auth
| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT | 公开 |
| POST | `/api/auth/logout` | 登出（前端清 token） | 登录 |
| GET  | `/api/auth/me` | 当前用户与角色 | 登录 |

### 6.2 任务 Task
| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/tasks?classId=&subjectId=` | 任务列表（行级权限） |
| POST | `/api/tasks` | 创建任务 |
| PUT  | `/api/tasks/{id}` | 修改任务 |
| DELETE | `/api/tasks/{id}` | 删除 |
| POST | `/api/tasks/{id}/save-template` | 保存为模板（指令7） |
| POST | `/api/tasks/from-template/{tplId}` | 从模板创建（指令7） |

### 6.3 完成登记 Completion
| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/completion/batch` | 科代表批量登记（**触发积分流水+更新 total_credits，写 operate_log**，指令3/6） |
| PUT  | `/api/completion/{id}` | 单条修改（记前后快照） |
| GET  | `/api/completion?taskId=&studentId=` | 查询（命中复合索引） |

### 6.4 学生 / 积分流水
| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/students?classId=` | 学生列表（含 total_credits） |
| GET  | `/api/students/{id}` | 学生详情 |
| GET  | `/api/students/{id}/credit-flow` | 积分流水（指令3 标签页） |
| GET  | `/api/students/{id}/trend` | 学分积累趋势（折线图，指令5） |

### 6.5 预警 / 推荐（指令4）
| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/alerts?classId=` | 教师预警中心 |
| GET  | `/api/alerts/me` | 学生端本人预警 |
| GET  | `/api/recommendations/me` | 学生端「待补修任务」推荐 |

### 6.6 数据看板 Dashboard（指令5）
| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/dashboard/completion-rate?classId=` | 各科目完成率（柱状图） |
| GET  | `/api/dashboard/status-distribution?classId=` | 完成状态分布（饼图） |
| GET  | `/api/dashboard/drilldown?type=&key=` | 下钻明细（点击图表触发） |

### 6.7 操作日志 / 系统（指令6）
| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/logs?operator=&type=&from=&to=` | 操作日志查询（按时间/人/类型筛选） |
| (Admin) | `/api/users` CRUD | 用户与角色管理 |

---

## 7. 分阶段实施计划（后续编码阶段）

### 阶段一 · 基础架构与数据模型（指令1–2）
- 后端：`pom.xml`（Boot3/MP/Security/JWT/Swagger/Scheduler）、`application.yml`、JWT 工具、统一 `Result`、全局异常、Axios 等价——*后端* 登录接口 + Swagger。
- 前端：`Vite+Vue3` 脚手架、Router、Pinia、`utils/request.js` 拦截器、登录页。
- **交付验收**：前端登录页能发请求、后端返回 JWT（指令1 评估标准）。
- DB：执行 `db/schema.sql`，验证联合查询命中索引（指令2 评估标准）。

### 阶段二 · 核心功能（指令3–5）
- 指令3：完成登记事务（`completion_record` + `credit_flow` + `student.total_credits`）；前端「积分流水」标签页。
- 指令4：`@Scheduled` 凌晨扫描（连续3未完成 / 截止前1天未完成）→ `alert`；学生端「待补修任务」推荐（按未完成+学分缺口）。
- 指令5：ECharts 看板（柱状完成率 / 饼图状态分布 / 折线学分趋势）+ 点击下钻。

### 阶段三 · 安全与交互（指令6–7）
- 指令6：Spring Security 行级 `class_id` 过滤切面；`operate_log` 前后快照（AOP/Interceptor）；前端「操作日志查询」。
- 指令7：任务模板（保存/从模板创建）；`vuedraggable` 拖拽多选；全局 `Ctrl+S`/`Ctrl+A` 快捷键。

### 阶段四 · 测试与部署（指令8–9）
- 指令8：JUnit（学分计算/权限校验/导出）+ Vitest（组件）覆盖 ≥80%。
- 指令9：`Dockerfile`×2 + `docker-compose.yml`（前端 Nginx / 后端 Jar / MySQL）+ README（部署步骤、环境变量、API 文档）。`docker-compose up -d` 一键启动。

---

## 8. 待你确认的关键决策

1. **任务粒度**：任务是「班级级」还是「每生一行」？（影响 `task` 表是否含 `student_id` 及复合索引定义，见 §5）。
2. **演示数据库**：是否接受 MySQL 8.0（生产）+ 可选 H2（本地快速验证）双配置？
3. **密码/密钥**：JWT 密钥、BCrypt 强度、初始管理员口令的占位策略（方案中用占位密文，上线前替换）。
4. **前端 UI 库**：默认 Element Plus，是否认可？

确认后，我将从**阶段一（指令1–2）**开始逐步实现并分批交付可运行代码。
