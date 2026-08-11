# 点滴进步 - 微信小程序

> 个人学习记录工具，与 Web 端共享同一套账号/数据体系。
> **不在仓库中保存 AppSecret** — 通过 `WX_APP_SECRET` 环境变量注入到后端服务。

## 一、本地开发

### 准备
- 微信开发者工具（https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html）
- 项目根目录：`miniprogram/`
- AppID：`wx64664e7fa8d4f747`（已写入 `project.config.json`，仅作开发标识）

### 步骤
1. 用「微信开发者工具」打开本目录
2. 工具栏"详情" → 不勾选"不校验合法域名"（生产环境必须 https）
3. 后端地址默认在 `app.js` 的 `globalData.apiBase` 中配置
4. 本地调试可改为 `http://localhost:4000`，并在微信公众平台 → 开发设置 → 服务器域名添加 `localhost`（或临时勾选"不校验"）

## 二、Tab 页面

| Tab | 页面 | 功能 |
|---|---|---|
| 首页 | `pages/index/index` | 用户卡 + 快捷入口 + 推荐资料 |
| 学习 | `pages/study/study` | 难度+兴趣分类筛选 + 兴趣资料列表 |
| 打卡任务 | `pages/tasks/tasks` | 待完成/已完成/逾期三 Tab + 提交跳转 |
| 成长圈 | `pages/feed/feed` | 信息流 + 发布 + 点赞 + 评论 |
| 我的 | `pages/me/me` | 积分明细入口 + 积分 + 退出登录 |

二级页：`login / submit / resource-detail / post-detail / credits`

## 三、与后端的接口约定

所有请求路径前缀为后端 API 地址 + `/api/`。

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/mp/auth/wx-login` | POST | 微信一键登录（公开） |
| `/api/auth/login` | POST | 账号密码登录（公开） |
| `/api/mp/resources?grade=&subject=&page=` | GET | 兴趣资料列表 |
| `/api/mp/resources/:id` | GET | 资料详情（含解锁状态） |
| `/api/mp/resources/:id/unlock` | POST | 看广告解锁 |
| `/api/mp/admin/resources` | GET/POST/PUT/DELETE | 资料管理（管理员） |
| `/api/mp/feed?page=` | GET | 成长圈信息流 |
| `/api/mp/posts` | POST | 发布动态 |
| `/api/mp/posts/:id/like` | POST | 点赞/取消 |
| `/api/mp/posts/:id/comments` | GET/POST | 评论 |
| `/api/mp/me/points` | GET | 积分余额 |
| `/api/mp/points/ad-reward` | POST | 看广告奖励积分 |
| `/api/tasks` | GET | 任务列表（复用 Web） |
| `/api/uploads` | POST | 上传附件（复用 Web，含 30MB 限制） |
| `/api/completion` | POST | 打卡（复用 Web） |

## 四、广告接入

待开通广告位后：
1. 微信公众平台 → 流量主 → 申请 banner / 激励视频广告位
2. 拿到 `adUnitId`，替换：
   - `pages/resource-detail/resource-detail.js` 中 `adunit-please-replace`
   - `pages/index/index.wxml` 底部 banner 处
3. 提交审核时勾选"含广告"

## 五、配置清单（部署前必做）

| 项 | 值 |
|---|---|
| 服务器域名 | 在微信公众平台后台添加 |
| 后端环境变量 | `WX_APP_ID`、`WX_APP_SECRET`（后端 Dashboard 配置） |
| adUnitId | 申请后填入 |

## 六、目前已实现 vs 待办

✅ **已实现**：登录（含微信一键登录入口）、4 Tab + 二级页骨架、兴趣资料展示（含免费配额提示）、成长圈发布/点赞/评论、积分明细入口、打卡（30MB 前端拦截）、积分显示

⏳ **待办（需用户决策后启用）**：
- 兴趣资料批量录入（Web 端后台管理页）
- 广告位开通与 adUnitId 接入
- 资料来源爬虫（需先确认安全白名单）
- 微信开放平台 unionid 跨小程序打通（如未来多小程序共享账号）

## 七、图标占位

`assets/tab/*.png` 5 对 tab 图标（首页/学习/打卡任务/成长圈/我的）已由 `make_icons.py` 生成真实 PNG（81×81 像素，未选中灰色 `#8893ad`、选中极光紫 `#7C5CFF`），无需再手动补图。如需更换风格，修改 `make_icons.py` 中的 `GRAY`/`RED` 常量后重新运行即可。
