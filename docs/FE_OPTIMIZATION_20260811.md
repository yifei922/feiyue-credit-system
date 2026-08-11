# feiyue-credit onrender 系统 · 八维度优化升级方案（2026-08-11）

> 研究对象：`https://feiyue-credit.onrender.com/login#`（Render 托管的 Vue3+Element Plus SPA 后台，搭配 Express+MySQL 后端）
> 资料来源：本项目源码深度扫描（Explore）+ 全网对标（习惯追踪类 Streaks/Habitica/Loop/Momentum；企业级后台 Ant Design Pro/Arco/Naive；等保 2.0/GDPR/ISO 27001；WCAG 2.1）。
> 本方案**未改任何代码**，待你确认后按优先级执行。

---

## 一、现状摘要（基于 Explore 源码调研）

**已具备**：RBAC 四角色（管理员/主理人/小组长/成员）+ 数据看板/任务/完成登记/成员管理/资料库/预警/设置/附件/操作日志 + 小程序侧社交/资料/微信登录完整闭环。
**关键缺口**（按风险由高到低）：
- 🚨 **路由守卫仅校验登录态、未做角色拦截** → 学生手敲 `/manage` 可绕过菜单直入管理页（最大越权窗口）
- 🚨 **未引入 helmet / 速率限制 / CORS 白名单 / 登录失败计数** → 免费层易被爆破
- 🟡 **重复代码**：`genTempPwd` 在 `users.js/students.js` 各一份；`ROLE_LABEL` 在三处复制；`STATUS_LABEL` 前后端各一
- 🟡 **Mock 残留**：`frontend/src/api/mock.js` 345 行，与后端对接后已无意义
- 🟡 **冷启动 30–50s 体验**：有提示但后台无骨架屏，列表请求 200ms+ 空白明显
- 🟢 **视觉一致性弱**：品牌红 `--brand: #c8102e` 只覆盖 Logo/链接，主按钮仍 EP 默认蓝紫

---

## 二、全网对标要点（提炼）

**习惯追踪类（Streaks/Habitica/Loop/Momentum）核心套路**：
- 日历网格 + 状态指示（完成/未完成/未来）+ streak 计数器是粘性三件套
- 立即视觉反馈（轻动效）> 复杂功能
- 徽章/成就/里程碑是重复打开的关键
- 数据导出/隐私透明（用户掌控自己的数据）

**企业级后台（Ant Design Pro/Arco/Naive）核心套路**：
- RBAC+ABAC 混合，前端路由 meta.roles 守卫 + 后端接口鉴权双层
- 全局快捷键（Ctrl+K 命令面板）、面包屑、403/404 区分
- 虚拟滚动万级表格、列配置持久化、Excel 双向导入导出
- 微交互动效、错误边界、空状态设计、深色模式、12/24 列响应式
- 安全：helmet、限流、CORS 白名单、登录失败计数、敏感操作二次确认、操作审计（截图留痕）

**合规与未来方向**：
- 等保 2.0 / GDPR / ISO 27001：最小权限、操作审计、操作人/IP/终端指纹
- AI 助手（智能补做推荐、习惯分析）、PWA 离线、多端同步、插件化、国际化、无障碍 WCAG 2.1

---

## 三、八维度优化建议

### ① 功能（Feature）

| # | 建议 | 优先级 | 对标 | 当前代码位置 |
|---|------|--------|------|--------------|
| F1 | **连续打卡 streak 统计**（个人里程碑）+ 日历热力图 | ★★★ | Streaks/Habitica | 缺；建议在 Dashboard.vue 加 streak 卡片与日历组件 |
| F2 | **里程碑/徽章系统**（首日/7 日/30 日/百日） | ★★ | Habitica 成就 | 缺；credit_flow 表已有流水，可加 `badge` 表 |
| F3 | **多渠道提醒**：站内 + 微信模板消息 + 邮件 | ★★ | Loop | 已有 `alerts` 模块，加微信模板消息推送（云函数） |
| F4 | **数据导出**（JSON/CSV）+ 用户所有权透明 | ★★★ | Momondo/Streaks | 已有 CSV 导出，补 JSON 导出 + 隐私页声明 |
| F5 | **AI 智能补做**（已有 recommend 模块）→ 升级为对话式推荐 | ★ | Notion AI | recommend.js 可加 LLM 接入 |
| F6 | **回收站**（删除前二次确认 + 7 天可恢复） | ★★ | Arco 反模式 | 缺；建议加 `deleted_at` 软删 + 回收站页 |

### ② 链接（路由/导航）

| # | 建议 | 优先级 | 对标 |
|---|------|--------|------|
| R1 | **路由 meta.roles 拦截**（修最严重越权） | ★★★ | Ant Pro 路由守卫 |
| R2 | **嵌套路由 + Outlet** 注入 MainLayout（已部分具备，规范化） | ★★ | deepwiki Admin 案例 |
| R3 | **动态面包屑**（基于路由元信息） | ★★ | Ant Pro |
| R4 | **404 与 403 区分**（未登录跳 login，无权限跳 403） | ★★ | 通用最佳实践 |
| R5 | **全局命令面板** Ctrl+K（搜索/跳转/操作） | ★ | Linear/Notion |
| R6 | **路由过渡动画** + 预加载（hover 时预加载 chunk） | ★ | Framer Motion |

具体落地 R1：在 `frontend/src/router/index.js` 给路由加 `meta.roles: ['ADMIN','TEACHER']`，`beforeEach` 加 `if (to.meta.roles && !to.meta.roles.includes(auth.role)) next('/403')`。

### ③ 模块（代码组织）

| # | 建议 | 优先级 |
|---|------|--------|
| M1 | **抽离共享 utils**：`server/src/utils/`（genTempPwd / ROLE_LABEL / STATUS_LABEL / scopeByManagedSubjects） | ★★★ |
| M2 | **清理 api/mock.js**（345 行 Mock 残留） | ★★ |
| M3 | **按业务域拆 Pinia store**（useTask/useStudent/useAlert/useCredit） | ★★ |
| M4 | **抽离 migrations/** 目录（K12→中性标签字典从 db.js 拆出） | ★ |
| M5 | **统一前后端枚举定义**（TypeScript 化或共享 OpenAPI schema） | ★ |

### ④ 安全（Security）

| # | 建议 | 优先级 | 对标 |
|---|------|--------|------|
| S1 | **加 helmet**（CSP/HSTS/X-Frame-Options） | ★★★ | 等保 2.0 |
| S2 | **加 express-rate-limit**（登录/重置密码接口限流） | ★★★ | OWASP |
| S3 | **CORS 白名单**（onrender 自定义域 + 小程序 API） | ★★ | OWASP |
| S4 | **登录失败计数 + 锁定**（同 IP/账号 5 次锁 15min） | ★★★ | 等保 2.0 |
| S5 | **敏感操作二次确认**（删数据/改角色/重置密码弹窗输账号名） | ★★ | 通用最佳实践 |
| S6 | **CSRF Token**（双 token / SameSite cookie） | ★★ | OWASP |
| S7 | **操作审计增强**：operate_log 加 IP/UA/截图（已有 operate_log.js，补字段） | ★★ | GDPR |
| S8 | **依赖漏洞扫描**（npm audit / Snyk 集成 CI） | ★ | DevSecOps |
| S9 | **MFA（可选）**：TOTP/邮件验证码，企业版可上 | 后期 | 等保 2.0 |

### ⑤ 使用（UX）

| # | 建议 | 优先级 |
|---|------|--------|
| U1 | **骨架屏** + 路由切换 NProgress（告别白屏感） | ★★★ |
| U2 | **空状态设计**（无数据/无搜索结果/无权限三类） | ★★ |
| U3 | **全局错误边界**（页面级 try/catch + 重试按钮） | ★★ |
| U4 | **表单历史记忆** + 智能填充（同字段自动同步） | ★ |
| U5 | **微交互动效**（按钮涟漪/列表拖拽/状态平滑过渡） | ★ |
| U6 | **拖拽排序**（任务/成员顺序持久化） | ★ |

### ⑥ 视觉（Visual）

| # | 建议 | 优先级 |
|---|------|--------|
| V1 | **统一 CSS 变量覆盖 EP 主题**：`--el-color-primary` 接 `--brand` | ★★★ |
| V2 | **深色模式**（CSS 变量 + localStorage 记忆） | ★★ |
| V3 | **圆角/阴影系统化**（--radius-sm/md/lg，--shadow-sm/md/lg） | ★★ |
| V4 | **字体阶梯**（--text-xs/sm/base/lg/xl/2xl） | ★★ |
| V5 | **间距系统**（--space-1 到 --space-8，4/8/12/16/24/32/48/64） | ★★ |
| V6 | **响应式栅格**（12/24 列弹性，移动端表格转卡片流） | ★★ |
| V7 | **Logo/品牌重塑**：降"斐越科技出品"为企业字脚 | ★ |

### ⑦ 操作便捷（Operability）

| # | 建议 | 优先级 |
|---|------|--------|
| O1 | **全局搜索 Ctrl+K**（用户/任务/资料/操作） | ★★ |
| O2 | **批量操作**（勾选 + 批量删/导出/改状态） | ★★ |
| O3 | **列配置持久化**（表格列宽/排序/显隐存 localStorage） | ★★ |
| O4 | **虚拟滚动**（万级成员/任务列表） | ★ |
| O5 | **键盘快捷键**（j/k 上下条、Enter 确认、Esc 关闭） | ★ |
| O6 | **可拖拽列头**、自定义仪表盘布局 | 后期 |

### ⑧ 未来进化（Future）

| # | 建议 | 优先级 |
|---|------|--------|
| FF1 | **AI 习惯分析助手**（周报/月报 + LLM 解读） | 后期 |
| FF2 | **PWA 离线优先**（Service Worker + IndexedDB） | 后期 |
| FF3 | **多端同步**（小程序 + Web + H5 实时同步打卡） | 后期 |
| FF4 | **插件化架构**（自定义习惯类型/字段） | 后期 |
| FF5 | **国际化 i18n**（zh-CN/en-US，预留多语言） | 后期 |
| FF6 | **无障碍 WCAG 2.1**（aria/keyboard/contrast） | 后期 |
| FF7 | **数据可视化大盘**（BI 化，ECharts→AntV G2） | 后期 |

---

## 四、优先级与执行路径

### 第一梯队（立即做，1~2 天）🚨
- **R1 路由 meta.roles 拦截**（修最严重越权）
- **S2 限流**（防爆破）
- **S4 登录失败计数**
- **M1 抽离 genTempPwd/ROLE_LABEL 重复代码**
- **V1 统一品牌色到 EP 主题**

### 第二梯队（1 周内）⭐
- **S1 helmet / S3 CORS 白名单**
- **M2 清理 mock.js / M3 拆 Pinia store**
- **U1 骨架屏 + NProgress / U2 空状态**
- **F1 streak + 日历热力图**（最能拉留存的视觉升级）

### 第三梯队（1 月内）🌟
- **F2 徽章系统 / F6 回收站**
- **R3 面包屑 / R4 403 区分 / R5 Ctrl+K 命令面板**
- **V2 深色模式 / V3-V6 设计系统化**
- **O1 全局搜索 / O2 批量操作 / O3 列配置持久化**

### 战略梯队（按需）🚀
- 国际化/PWA/AI 助手/MFA/插件化（需结合过审路线/变现路线决策）

---

## 五、与现有方案的协同

- **过审路线**（PASS_PLAN_20260811.md）→ 选路线 1 纯个人工具重构后，部分功能建议（F2/F5/R5 等）需调整为"个人视角"
- **Web 广告变现**（WEB_AD_MONETIZATION_20260811.md）→ 在 onrender 新增**公开内容站**（/blog /about /privacy），与本方案的 V1 主题统一共用
- 三个方案**不冲突**，建议按优先级并行推进

---

## 六、确认后立即可落地的 3 个最小动作

如果你想马上动手，下面三项**零风险、可独立上线**，工时 ≤ 0.5 天：

1. **加路由角色守卫 R1**（一行配置 + beforeEach 几行代码）
2. **加 helmet + 限流中间件 S1+S2**（`npm i helmet express-rate-limit`，index.js 全局注册）
3. **统一品牌色 V1**（styles/main.css 加 `--el-color-primary: var(--brand)`）

确认后我直接出代码改动并自测通过。

---

*完整对标资料见 `docs/FE_OPTIMIZATION_20260811.md`（本文）。待你选定优先级/确认是否动手，我再出具体任务清单与代码。*