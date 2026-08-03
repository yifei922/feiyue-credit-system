# 微信小程序端架构与展示设计

> 项目：洛一高附中八（十）班学分管理系统（Web → 小程序）
> 目标：在**不破坏现有 Web 架构**的前提下，新增小程序端作为「前端 B」，复用后端 API，扩展社交与课程资料，按广告流量变现。
> AppID: `wx0fe78d74fdc47c1b`（AppSecret 不入库，仅本地 `.env`）

---

## 一、总体架构

```
┌────────────────────────────────────────────────────────────────────┐
│                       现有架构（保持运行）                          │
│  ┌──────────────────┐         ┌──────────────────────────────┐    │
│  │  Web 前端 (Vue)   │ ───────▶│  Express + better-sqlite3     │    │
│  │  feiyue-credit    │  /api/* │  + ffmpeg + multer + WAL     │    │
│  └──────────────────┘         └──────────────────────────────┘    │
│                                      ▲                             │
│                                      │ 复用（同一份代码、同一份 DB） │
│  ┌──────────────────┐                │                             │
│  │  小程序前端 (新增)│ ───────────────┘                             │
│  │  uni-app / 原生  │                                              │
│  └──────────────────┘                                              │
└────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                ┌─────────────┴──────────────┐
                │  微信小程序广告 SDK           │
                │  (banner + 激励视频 + 插屏)  │
                └────────────────────────────┘
```

**关键原则**：
- ✅ 后端代码**不动**（路径、字段、行为完全兼容）
- ✅ 数据库**不动**（新增表用 `IF NOT EXISTS` 安全演进）
- ✅ Web 端**不动**（继续运行，不受影响）
- ✅ 小程序端是**全新的代码树**，放在 `miniprogram/` 目录

---

## 二、技术选型（待用户确认）

| 选项 | 优势 | 劣势 |
|---|---|---|
| **uni-app（Vue 语法）** | 与现有 Vue 代码思路一致；一套代码可同时编译到 H5/小程序/Android/iOS；生态成熟 | 学习成本中等；部分小程序 API 需条件编译 |
| **Taro（React 语法）** | 京东系生态，类型友好 | 与现有 Vue 项目割裂 |
| **原生小程序（wxml/wxss/js）** | 无第三方依赖，性能最佳 | 工作量最大；不能跨端 |

**建议：uni-app（Vue 语法）**，理由：复用现有 Vue 经验、`manifest.json` 一份配多端、微信小程序官方支持良好。

---

## 三、功能裁剪（与扩展）

### ✅ 保留（核心：学生/教师/科代日常使用）
| 模块 | 说明 |
|---|---|
| 登录 | 微信一键登录 + 账号密码兜底（与 Web 同套账号体系） |
| 个人中心 | 头像、姓名、学号、总学分、当前班级 |
| 学分明细 | 个人流水（来源任务、变动金额、类型、时间） |
| 任务列表 | 待完成 / 已完成 / 逾期 三类 tab |
| 提交作业 | 选任务 → 选附件 → 上传（复用 `/api/uploads`，SSE 进度可降级为普通轮询）|
| 班级信息 | 班级成员、本周考勤、当前周次 |
| 预警中心 | 连续未完成、即将截止 |

### ❌ 去掉（Web 端后台管理功能，小程序不做）
| 模块 | 原因 |
|---|---|
| 教师/管理员后台（账号管理、科目管理、操作日志、存储用量看板） | Web 端独有 |
| 系统设置（保活、压缩策略） | 运维功能 |
| 班级管理 / 课代表配置 | 后台用 |

### ➕ 新增（社交 + 课程资料 + 变现）
| 模块 | 数据表 | 说明 |
|---|---|---|
| **班级圈（动态）** | `post`, `post_like`, `post_comment` | 学生发图文/短视频动态；点赞、评论；可关联学习任务 |
| **课程资料库** | `resource`(id, grade, subject, title, type, url, size, tags, ad_view_count, free_view_quota) | 按年级（初一/初二/初三）+ 科目（语数英物化政史地生）分类；学生可免费看 N 次/天，超出需看激励视频广告解锁 |
| **积分系统** | `user_points`(user_id, points, total_earned) | 看广告得积分；积分换"下载次数""资料解锁"等 |
| **广告位** | 由微信小程序广告 SDK 提供 | 底部 banner、详情页激励视频、章节末尾插屏 |

---

## 四、小程序页面结构（4 个 tab + 多个二级页）

### Tab 1 · 🏠 首页
- 顶部 Banner（公告/作业提醒，运营位）
- 当前用户信息卡：姓名 + 班级 + 总学分（大字 + 进度环）
- **快捷入口**：今日任务、本周推荐资料、班级最新动态
- **初中年级段推荐**（核心变现区）：
  - 横向滚动卡片：年级筛选（初一/初二/初三）
  - 科目筛选（语/数/英/物/化/政/史/地/生）
  - 卡片内容：标题、封面、免费/激励视频标签、观看次数
  - **前 N 次点击直接打开；超出后弹"看 15 秒广告解锁"**
- 底部 Banner 广告位（微信小程序 banner 组件）

### Tab 2 · 📚 学习（课程资料）
- 顶部：年级切换（初一/初二/初三）+ 科目切换
- 内容瀑布流（图文 + 视频缩略图）
- 搜索框（标题 + 标签）
- 详情页：资料预览 + 立即查看 / 看广告解锁
- 列表底部/详情底部：激励视频广告位

### Tab 3 · 📝 作业（任务/提交）
- 任务列表 Tab：待完成 / 已完成 / 逾期
- 单个任务详情：题目要求 + 截止时间 + 提交按钮
- 提交页：选附件（图片/视频/音频/文档）、上传进度、压缩状态
- 我的提交记录（含附件预览）

### Tab 4 · 💬 班级圈（社交）
- 信息流：同学发的图文/视频动态（无限滚动）
- 发布按钮：选图/视频 → 输入文字 → 发布
- 互动：点赞、评论（弹层）
- 单条动态详情：评论列表 + 评论框

### 抽屉 / 二级页面
- 个人中心（点击头像进入）
- 学分明细
- 积分明细
- 关于我们

---

## 五、变现模型设计

| 形式 | 触发场景 | 收益 |
|---|---|---|
| **底部 banner 广告** | 首页、Tab 页面底部常驻 | CPM，按曝光计费 |
| **激励视频广告** | 资料解锁 / 积分兑换 / 提交附加功能 | 按观看完成计费（单价更高） |
| **插屏广告** | 进入某些功能时（克制使用，避免影响体验） | 按曝光计费 |
| **资料付费**（可选） | 高级资料可设置小额付费（1 元 / 份） | 直接收入 |

### 防滥用设计
- 每个用户每天有 N 次"免费查看资料"额度（默认 3 次，可配置）
- 超出后**必须看完激励视频**才能解锁（不能跳过）
- 后端记录 `ad_view_count` 防重复请求

---

## 六、后端扩展（不影响现有 Web）

### 6.1 新增数据表（migrate 安全演进）
```sql
-- 动态
CREATE TABLE IF NOT EXISTS post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT,
  images TEXT,           -- JSON array
  video_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_post_created ON post(created_at DESC);

-- 点赞
CREATE TABLE IF NOT EXISTS post_like (
  post_id INTEGER, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

-- 评论
CREATE TABLE IF NOT EXISTS post_comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER, user_id INTEGER, text TEXT, created_at TEXT DEFAULT (datetime('now'))
);

-- 课程资料
CREATE TABLE IF NOT EXISTS resource (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade TEXT NOT NULL,        -- 初一/初二/初三
  subject TEXT NOT NULL,      -- 语数英...
  title TEXT NOT NULL,
  cover TEXT,
  type TEXT NOT NULL,         -- article/video/pdf/link
  url TEXT NOT NULL,
  description TEXT,
  tags TEXT,                  -- JSON array
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resource_gs ON resource(grade, subject);

-- 用户积分
CREATE TABLE IF NOT EXISTS user_points (
  user_id INTEGER PRIMARY KEY,
  points INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0
);

-- 每日免费查看配额
CREATE TABLE IF NOT EXISTS user_daily_view (
  user_id INTEGER, day TEXT, view_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- 广告观看记录（防刷）
CREATE TABLE IF NOT EXISTS ad_view_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, ad_unit TEXT, resource_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
);
```

### 6.2 新增 API（路径前缀 `/api/mp/*` 区分 Web，便于演进）
- `GET /api/mp/feed?page=N` — 班级圈动态
- `POST /api/mp/posts` — 发布动态
- `POST /api/mp/posts/:id/like` — 点赞/取消
- `GET /api/mp/posts/:id/comments`
- `POST /api/mp/posts/:id/comments`
- `GET /api/mp/resources?grade=&subject=&page=` — 课程资料
- `GET /api/mp/resources/:id` — 资料详情（鉴权 + 检查配额/积分）
- `POST /api/mp/resources/:id/unlock` — 看广告解锁（前端调 wx.ad 后回调）
- `GET /api/mp/me/points` — 积分余额
- `POST /api/mp/auth/wx-login` — 微信一键登录（用 wx.login 拿 code，换 openid，关联现有 sys_user）

### 6.3 微信登录最小实现
```
小程序: wx.login() → code → POST /api/mp/auth/wx-login
后端:  用 code + AppID + AppSecret 调微信接口换 openid
       → 查 sys_user.openid 是否存在
       → 不存在：自动建账号（昵称+头像随机）+ 给一个临时密码让用户绑定
       → 存在：返回 JWT（同套 auth 体系）
```

### 6.4 安全约束
- AppSecret **只在后端环境变量** `WX_APP_SECRET`，不入库不入代码
- 小程序调用后端接口必须 `https://`（已有 Render）
- 接口限流（防刷广告激励）：每天每用户每资源 ≤ 20 次解锁

---

## 七、文件结构

```
feiyue-credit/
├── server/                ← 现有后端（不动主体，新增 mp 路由）
│   └── src/
│       ├── routes/
│       │   ├── mp_feed.js        ← 新增：班级圈
│       │   ├── mp_resources.js   ← 新增：课程资料
│       │   ├── mp_points.js      ← 新增：积分
│       │   └── mp_auth.js        ← 新增：微信登录
│       └── lib/
│           └── ad.js             ← 新增：广告激励回调校验
├── miniprogram/            ← 新增：小程序代码树
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index/           ← Tab1 首页
│   │   │   ├── study/           ← Tab2 学习
│   │   │   ├── tasks/           ← Tab3 作业
│   │   │   ├── feed/            ← Tab4 班级圈
│   │   │   ├── me/              ← 个人中心
│   │   │   ├── points/          ← 积分明细
│   │   │   ├── credits/         ← 学分明细
│   │   │   ├── submit/          ← 提交作业
│   │   │   ├── post-detail/     ← 动态详情
│   │   │   ├── resource-detail/ ← 资料详情
│   │   │   └── login/           ← 登录
│   │   ├── components/          ← 复用组件
│   │   ├── api/
│   │   │   ├── request.js       ← 封装 wx.request
│   │   │   ├── auth.js
│   │   │   ├── tasks.js
│   │   │   ├── feed.js
│   │   │   └── resources.js
│   │   ├── stores/              ← pinia 或简单 store
│   │   ├── utils/
│   │   └── App.vue
│   ├── manifest.json          ← uni-app 配置（含 AppID）
│   ├── pages.json
│   ├── static/
│   └── README.md
├── docs/
│   └── MINIAPP_DESIGN.md      ← 本文件
└── ... (现有结构不动)
```

---

## 八、配置清单（部署前需要做的事）

### 8.1 微信公众平台后台（mp.weixin.qq.com）
1. 登录 → 设置 → 开发设置 → **AppID**（已有）+ **重置 AppSecret**
2. 服务器域名：添加 `https://feiyue-credit.onrender.com`
3. 业务域名：同上
4. 体验成员：添加测试微信号

### 8.2 广告开通
1. 微信公众平台 → 流量主 → 广告位 → 申请 banner / 激励视频
2. 获批后拿到 adunitId，填入 `manifest.json` 和 `miniprogram/src/config/ad.js`

### 8.3 后端环境变量（Render Dashboard）
```
WX_APP_ID=wx0fe78d74fdc47c1b
WX_APP_SECRET=<重置后的新值，不要入库>
WX_AD_REWARD_UNIT_ID=<激励视频广告位 ID>
```

### 8.4 后端依赖
- `axios` 或 `undici` 用于调微信接口
- 新增表 migrate 在 `db.js` 的 `migrate()` 函数里用 `IF NOT EXISTS`

---

## 九、开发阶段（分批交付）

| Phase | 内容 | 预计产出 |
|---|---|---|
| **P1 后端扩展** | mp 路由 + 新表 + 微信登录 + 课程资料 CRUD | 10+ 个新 API，无破坏性改动 |
| **P2 小程序骨架** | uni-app 项目初始化 + 4 个 Tab + 登录 + 个人中心 + 任务列表 + 提交作业（复用现有上传 API） | 微信开发者工具可预览的最小可用版本 |
| **P3 社交（班级圈）** | 发布/点赞/评论/信息流 | 完整社交闭环 |
| **P4 课程资料库** | 后台管理（Web 端加一个入口）+ 小程序展示 + 免费配额 + 广告解锁 | 核心变现功能 |
| **P5 广告接入** | banner + 激励视频组件 + 后端激励回调 | 流量变现上线 |

每个 Phase 完成后都可以独立测试、推送。

---

## 十、下一步

请你回答下面 3 个关键决策，我就可以开干 P1（后端扩展）：