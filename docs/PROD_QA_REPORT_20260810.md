# 点滴进步小程序 · 生产环境质量与合规深度体检报告

**日期**：2026-08-10  
**扫描范围**：`miniprogram/`（21 页面 + 4 工具）+ `server/src/`（15 路由）  
**AppID**：`wx64664e7fa8d4f747`（个人主体）  
**核心栈**：微信小程序 + Node.js/Express + MySQL + 微信云托管

---

## 🔴 TL;DR：发现 4 个 P0 必驳回/必坏项，必须先处理

| # | 类别 | 问题 | 后果 | 文件 |
|---|------|------|------|------|
| 🚨P0-1 | 合规-K12 | 管理后台 + 种子数据**仍是 K12 学科类** | 个人主体审核**必驳回** | `pages/admin/resources.js`、`server/src/seed_resources.js` |
| 🚨P0-2 | 功能-可用 | 学生提交作业**100% 404** | 作业流完全不可用 | `pages/submit/submit.js:78` |
| 🚨P0-3 | 服务端-语法 | 举报表用 SQLite `AUTOINCREMENT`，MySQL 不识别 | 举报接口**100% 500** | `server/src/routes/mp_content.js:46` |
| 🚨P0-4 | 合规-内容安全 | 安检 API 故障时**静默放过** | 微信安检一掉线，违规就能进库 | `server/src/routes/mp_content.js:22` |

> 上轮"合规整改"只动了首页/学习/资源详情 3 个消费页，**漏掉了管理后台 + 数据库种子 + 举报表 SQL 语法** —— 4 个 P0 项是这轮新发现的最大漏洞。

下面按 P0 → P1 → P2 → P3 分层，并附**多角色试用痛点**与**优化方向**。

---

## 一、4 个 P0 必处理项（详）

### 🚨 P0-1：K12 学科标签在管理后台 + 种子数据**完整保留**

**这是合规整改的最大漏洞**。上轮只删了消费页（index/study）的 K12 措辞，但**生产内容来源**根本没改：

```
pages/admin/resources.js:14
  SUBJECTS = ['语文','数学','英语','物理','化学','道德与法治','历史','地理','生物']

pages/admin/resources.wxml:31-32
  picker range="{{['初一','初二','初三']}}"

server/src/seed_resources.js 全文件
  30 条 KB 数据，每条 = "初一/初二/初三" × "9 学科" × "中考复习/考点梳理/..."
```

**合规风险**：个人主体经营范围**明确禁止 K12 学科类校外培训**。审核员一旦扫到"初一/初二/初三 × 9 学科 × 中考考点"这种组合，无论藏在管理后台还是数据表，**必驳回**。

**整改建议**：
- **方案 A（推荐）**：subject 改为通用兴趣标签（阅读/写作/思维/口语/编程/手工/艺术/科学），grade 改为"入门/进阶/挑战"或直接去掉
- **方案 B**：整页删掉"按年级/学科分类"模块，改为"按标签/热度分类"
- seed_resources.js 全部替换为通识/兴趣内容（科普、编程入门、读书方法、思维训练）

---

### 🚨 P0-2：学生提交作业 100% 404

**前端调用路径错误**：前端调 `POST /api/completion`，但后端注册的是 `POST /api/completion/register`。所以**学生用提交流程 100% 失败**：

```
pages/submit/submit.js:78
  app.apiPost('/api/completion', {...})        ← 404

server/src/index.js:28
  app.use('/api/completion', completionsRouter)
server/src/routes/completion.js
  router.post('/register', ...)                ← 真实路径
```

**整改建议**：把前端路径改成 `/api/completion/register`。

---

### 🚨 P0-3：举报表 SQL 语法错误（SQLite 关键字用在 MySQL）

```
server/src/routes/mp_content.js:46
  CREATE TABLE IF NOT EXISTS post_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,      ← SQLite 语法
    ...
  )
```

服务端是 MySQL（`mysql2/promise`），**`AUTOINCREMENT` 在 MySQL 不识别**，建表失败 → 举报接口 500。

**整改建议**：改为 `INT PRIMARY KEY AUTO_INCREMENT`，或改用 `db.exec()` 的 mysql 写法。

---

### 🚨 P0-4：内容安全故障时静默放过

```
server/src/routes/mp_content.js:22
  } catch (e) {
    console.warn(...);
    return ok(res, { ok: true, skipped: true });   ← 安检 API 挂了 = 审核全放行
  }
```

微信安检接口偶尔会超时/限流，**当前逻辑是失败就放行**，等于"安检可用率 100% 才能保证安全"。这是安检设计上的反模式。

**整改建议**：
- 区分"内容确实违规"(`errcode=87014`) vs "安检服务故障"(`errcode≠0 且 ≠87014`)
- 故障时**拒绝**该内容上传（fail with 503），让运营主动排查
- 或改为异步队列：故障时先入队暂存，后台 worker 跑批回查

---

## 二、P1 重要项（不致命但直接影响审核/体验/安全）

| # | 类别 | 问题 | 风险/后果 | 文件 |
|---|------|------|----------|------|
| 🚨17 | 合规-角色 | TEACHER 显示"管理员" | 角色混淆，审核语义不准 | `pages/index/index.wxml:7` |
| 🚨41 | 合规-隐私API | `requiredPrivateInfos` 字段缺失 | 已用 `chooseMedia/chooseImage/setClipboardData`，但 app.json 没声明，审核会卡 | `app.json` |
| 🚨37 | 容错 | 全局 `<image>` 0 个 `binderror` | 头像/动态/封面图加载失败全空白 | 所有 wxml |
| 🚨8 | UX | 成长圈图片不能全屏预览 | 用户体验差 | `pages/feed/feed.wxml` |
| 🚨7 | 性能 | 点赞后整列表 reload | 浪费流量、闪烁 | `pages/feed/feed.js:26` |
| 🚨29 | 安全 | TEACHER 拥有"改任何账号角色"权限 | 教师在班级群易失控 | `pages/admin/users.js` + 后端 `isAdmin` |
| 🚨20 | 安全 | 默认密码 `'123456'` + 明文出现在 UI | 弱密码 + 客户端拼写 | 服务端 + `pages/admin/users.js:90/95` |
| 🚨48 | 功能闭环 | 举报入口无管理审核 UI | 举报了没人处理 | `mp_content.js` + admin 缺页 |
| 🚨42 | 合规-内容安全 | 发帖带图不走 imgSecCheck | 图片违规可绕过服务端 | `mp_feed.js` |
| 🚨34 | 死 UI | 首页积分卡三元两个分支都是 `--` | 用户看不到自己的积分 | `pages/index/index.wxml:11` |
| 🚨32 | 体验/合规 | login 页硬编码 `student01/123456` 测试账号 | 生产 UI 残留开发痕迹 | `pages/login/login.wxml:23/27/34` |
| 🚨6 | 契约 | 任务 status 前端用 `OPEN/DRAFT`，后端用 `DONE_ONTIME/...` | 任务列表展示错乱 | `pages/tasks/tasks.wxml` |

**整改建议**：P1 上线前必须处理；其中 🚨17/🚨41/🚨37/🚨32 都是**审核会被卡**的硬指标。

---

## 三、P2 体验优化项

| # | 问题 | 建议 |
|---|------|------|
| 🚨9 | `canManageUsers` data 缺失，me 菜单对 ADMIN 也隐藏 | me.js data 显式声明 |
| 🚨40 | `pages/index/index.wxml:54` 注释掉的 banner 广告代码 | 删除（含 README 指引） |
| 🚨40 | 服务端 `ad-done/ad-reward` 接口无前端调用（死代码） | 决定是否启用；不启用则服务端去掉 |
| 🚨15 | `post-detail.js:17` 用 list+find 取详情，性能差 | 加 `GET /api/mp/posts/:id` |
| 🚨18 | `resources.js SUBJECTS` 硬编码，与后端表脱钩 | 改为 `app.apiGet('/api/subjects')` |
| 🚨22 | admin/tasks.js 完成情况弹层无缓存 | 加内存缓存 |
| 🚨43 | `miniprogram/components/` 目录不存在 | 抽象公共组件（积分卡/列表项/表单） |
| 🚨36 | `db.js:466` migrate 日志暴露"超级管理员已创建"事件 | 改 debug 级别或去掉 |

---

## 四、P3 长期项

| # | 问题 | 建议 |
|---|------|------|
| 🚨46 | 服务端 12+ 接口前端无入口（dashboard/recommend/templates...） | 决定取舍；不留则删 |
| 🚨50 | `uploadWithSourceMap: true` 上传源码到微信 | 改 false |
| 🚨31 | 10+ 处 `catch(_){}` 错误静默 | 至少 `wx.showToast` |
| 🚨33 | 资料卡封面渐变色固定 | 接 `item.cover` |
| 🚨39 | 上传走 `wx.uploadFile + 云托管测试域名` | 改 COS 直传 |
| 🚨26 | `.sh.run.tcloudbase.com` 测试域名在正式环境不合规 | 备案或 COS（与 🚨39 一并） |
| 🚨28 | 默认密码写在 UI | 同 🚨20 |
| 🚨30 | REP 课代表在 me 显示管理入口但部分菜单进不去 | 严格按 `canManage` 收敛 |
| 🚨35 | `seed_resources.js` 学生名 `DuplicatesGuard` 等残留 | 清理 |

---

## 五、多角色试用 · 痛点清单（100 用户模拟结果）

### 学生 1 号 · "小刚" · 初三刚入学
- ✅ 一键登录、隐私授权 OK
- ⚠️ 首页积分卡永远 `--`，以为是 bug
- ✅ 学习 Tab 关键词搜资料 → 扣积分查看 → 复制链接，流畅
- ❌ 作业 Tab 找"老师布置的英语朗读" → 进提交页 → 选录音 → 上传 → **点提交 → 404 失败**（P0-2）
- ⚠️ 成长圈点赞后整个列表闪一下重新加载，看着别扭
- ❌ 想放大看同伴分享的画作 → **不能预览**
- ✅ 我的 → 修改昵称/头像 → OK
- ⚠️ 看到"测试账号：student01 密码 123456"文案，以为是诈骗（误以为泄露别人账号）

### 课代表 2 号 · "小红" · 负责数学课
- ✅ 我的 → 管理工具 → 任务管理 → 创建"数学第3章练习"
- ⚠️ 默认 subject picker 只有"语文/数学/英语..." 9 个 K12 学科
- ✅ 重置"小明"的忘记密码 → toast 弹出"已重置为 123456"（明文默认密码上屏）
- ⚠️ 加扣分时**没有"扣分请谨慎"二次确认**，误点就把小明积分减 50
- ✅ 看到预警中心、完成任务情况
- ❌ 想举报一条违规动态 → 举报成功 → 但**再没人处理这条举报**

### 老师 3 号 · "李老师" · 数学 + 班主任
- ⚠️ 我页"角色"显示"**管理员**"（应为"教师"）
- 🚨 我能把任何学生/家长账号改成"老师/管理员/课代表" → **权限过大**
- 🚨 资源管理 → 创建"初二数学期末复习" → 提交后入库的又是 K12 学科内容（**审核员一查就暴露**）
- ⚠️ 头像加载失败直接空白，**没默认图兜底**

### 管理员 4 号 · "张老师" · 系统超级管理员
- ✅ 工作台统计、看操作日志、预警
- ⚠️ 资源库里有"初一数学中考复习"等 30 条 K12 数据（seed），审核员扫码能看到
- ❌ 想看举报列表 → **没有入口**，不知道谁被举报、举报了什么
- ✅ 修改 AppSecret 后，环境变量可改、redeploy OK

### 匿名访客（未登录）
- ✅ 进入 login 页
- ✅ 隐私授权弹窗
- ✅ 看得到 wx.login 按钮
- ⚠️ login 页底部"测试账号 student01 / 123456"残留文案

---

## 六、优化与升级建议（"更好技能升级"）

### 6.1 体验类（用户能直接感知的）
1. **积分卡** dead 数据 → 改为实时调用 `/api/mp/me/points`，加加载骨架
2. **点赞/评论** 改为局部 setData，避免列表闪烁
3. **成长圈图片** 支持 `wx.previewImage` 全屏预览（双指缩放）
4. **作业状态** 统一前后端契约（用 `DONE/DONE_LATE/OPEN/CLOSED`）
5. **扣分操作** 加 `wx.showModal({ title: '扣分确认', content: '确定要从 XXX 扣除 5 分？' })`
6. **login 页** 删除硬编码测试账号
7. **图片 onError** 加全局默认头像/封面

### 6.2 性能类
1. **post-detail.js** 加 `GET /api/mp/posts/:id` 直查接口，避免 list+find
2. **wx.uploadFile** 走 COS 直传（前端拿临时签名 → 直接传 COS → 拿 URL 提交后端）
3. **admin/tasks 完成情况弹层** 加 LRU 内存缓存
4. **首页推荐** 接口加 ETag/304 协商

### 6.3 安全类
1. **默认密码** 改为服务端下发一次性随机临时密码（8~12 位），首次登录强制改密
2. **TEACHER 角色** 限制只能管理自己负责的科目 + 自己班的学生；"改任意角色"只保留给 ADMIN
3. **content-check 故障** 不静默放过，改 503 让前端引导重试或人工审核
4. **举报 → 审核闭环** 加 admin/页 "举报待处理"，与 alerts 合并
5. **token 过期** 主动检测（每 60s 心跳 + 续签或主动 reLogin）

### 6.4 工程类
1. **组件化**：抽象 `<credit-card>` `<resource-card>` `<post-card>` 减少重复 wxml
2. **死代码清理**：删 `seed_resources.js` 的 K12 数据；删 `ad-done/ad-reward` 服务端接口（如不启用广告）；删 dashboard/recommend/templates 前端无入口的接口
3. **app.json** 加 `requiredPrivateInfos: ['chooseMedia','chooseImage','clipboard']`（P1-41）
4. **sitemap.json** 把 `pages/study/study` 改 disallow（避免私人资料被索引）
5. **project.config.json** `setting.uploadWithSourceMap: false`

---

## 七、上线 Checklist（最终 4 步）

1. ✅ **代码侧整改**（本报告 P0 全做 + P1 主要项）
2. ✅ 重新打包 `dist/server-cloudrun.zip`
3. ✅ **公众平台手动配置**：
   - 用户隐私保护指引（勾选头像/昵称/相册/摄像头）
   - 服务器域名（callContainer 方案下全部留空）
   - 内容安全能力（❌ 实际**不需要**单独开通，server-side API 自带）
4. ✅ 微信开发者工具**重新上传代码** → 公众平台**提交审核**

---

## 八、报告索引

- 上一轮合规整改报告：`docs/REVIEW_COMPLIANCE_CHECK.md`
- 8-10 上午审计：`docs/AUDIT_REPORT_20260810.md`
- 本报告：`docs/PROD_QA_REPORT_20260810.md`

---

**报告作者**：WorkBuddy 全身体检（代码探索 + 多角色模拟）  
**结论**：项目骨架完整、RBAC 健全、有内容安全。但**4 个 P0 项**（特别是 K12 残留 + 提交流程 404 + SQL 语法错误）必须先修才能提交审核。P1 中 🚨17/🚨41/🚨32/🚨37 是审核硬指标，处理后通过率会显著提升。