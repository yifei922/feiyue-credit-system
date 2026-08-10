# 微信小程序提交审核前 · 合规深度审查报告

> 审查时间：2026-08-10
> 审查范围：`miniprogram/` 全量页面 + utils + config（只读扫描）
> 小程序定位：个人学习记录 / 积分管理工具（个人主体，类目申报「管理」审核中）
> 结论（整改前）：**当前状态直接提交审核，预计被驳回概率极高（P0 × 4 均为硬性驳回项）**
>
> **整改状态（2026-08-10 已完成代码侧修复，提交前还需控制台操作）**：
> - ✅ P0-4 广告下线：`utils/ad.js`、`config/ad-config.js` 已删；`index.js`/`resource-detail.js`/`app.js` 广告逻辑与「看广告」文案清除
> - ✅ P0-3 K12 表述：首页/资料库页年级、学科矩阵、课程资料文案改为中性「学习资料」；`preview/`、`README.md` 等已加 `packOptions.ignore` 排除出包
> - ✅ P0-2 隐私指引：`app.json` 加 `__usePrivacyCheck__:true`；新增 `utils/privacy.js` 并在 `app.js` 启动触发授权弹窗
> - ✅ P0-1 内容安全：后端 `wx.js` 加 `msgSecCheck/imgSecCheck`；`mp_feed` 发帖/评论前强制文本检测；`uploads` 图片上传强制检测；新增 `mp_content.js`（检测代理 + 举报）；`feed` 加举报入口；管理员可删动态（已有）
> - ✅ P1-1 外链：去掉「去浏览器打开」提示，改为站内复制
> - ✅ P1-2 调试页：`pages/debug/telemetry` 已从 `app.json` 移除并删文件
> - ✅ P1-3 域名：`project.config.json` `urlCheck` 改回 `true`；`sitemap.json` 改为白名单（admin/* 不索引）；`packOptions.ignore` 排除预览/测试文件
> - ✅ P2-1：`app.js` `getSystemInfoSync` → `getWindowInfo`
>
> **⚠ 上线前你必须在微信公众平台/云托管控制台完成（代码改不了，需手动）：**
> 1. 公众平台「设置 → 服务内容声明 → 用户隐私保护指引」勾选：头像、相册、摄像头、昵称，并填写收集目的（否则隐私弹窗无内容，仍可能驳回）
> 2. 公众平台开通「内容安全」能力（免费基础版），否则后端 `msgSecCheck` 调用会失败（已做软失败兜底，但不检测）
> 3. 公众平台「开发 → 开发设置 → 服务器域名」配置 request / uploadFile / downloadFile 合法域名（云托管公网域名 `*.sh.run.tcloudbase.com` 及备案域名），否则真机/审核环境请求被拦
> 4. 云托管控制台「服务设置 → 环境变量」将 `WX_APP_ID` 改为正式号 `wx64664e7fa8d4f747`，然后重新上传最新 `dist/server-cloudrun.zip` 部署（含内容安全后端）
> 5. 微信开发者工具重新上传小程序代码（含上述前端整改）

---

## 一、P0 · 必驳回（不修必被拒）

### P0-1 UGC 全链路无内容安全检测【内容安全】
- 命中：`pages/feed/feed.js`（成长圈动态流）、`pages/post-detail/post-detail.js`（发帖/评论）、`pages/submit/submit.js:89`（作业文件上传）、`pages/profile/profile.js`（头像上传）
- 问题：全代码库 `msgSecCheck / imgSecCheck / mediaCheckAsync` **零命中**，无举报/屏蔽/删除机制。任何用户发帖、评论、上传图片均不经内容安全审核，违反《微信小程序平台运营规范》UGC 强制要求。
- 修复：
  - 前端发帖/评论/上传前调用 `wx.serviceMarket` 或后端 `security.msgSecCheck`（文本）、`security.imgSecCheck` / `mediaCheckAsync`（图片）
  - 后端入库前二次校验
  - 补「举报」入口 + 管理员删除接口（`admin/*` 已有后台，可加）

### P0-2 收集个人信息但无隐私保护指引【隐私合规】
- 命中：`app.json` 无 `__usePrivacyCheck__`；全项目 `隐私 / privacy` 字样零命中
- 问题：使用了 `wx.chooseMedia`（相册+摄像头，见 `submit.js:30`、`profile.js`）、姓名/学号等个人信息采集，但未在代码开启隐私校验，也未在公众平台配置《用户隐私保护指引》。2023-09-15 起为强制要求，未配置会直接审核失败/被下架。
- 修复：
  - `app.json` 增加 `"__usePrivacyCheck__": true`
  - 接入 `wx.requirePrivacyAuthorize` 弹窗授权
  - 公众平台「设置 → 服务内容声明 → 用户隐私保护指引」勾选：头像、相册、摄像头、昵称，并填写收集目的

### P0-3 K12 学科培训表述与「个人主体 + 管理类目」不符【类目与资质】
- 命中：`pages/index/index.js:8-9`（年级 `初一` + 学科矩阵 `语文 数学 英语 物理 化学 道德与法治 历史 地理 生物`）、`pages/study/study.js`（同）、`pages/index/index.wxml`（"课程资料"）
- 问题：
  1. **个人主体不可从事 K12 学科培训**（需办学许可证/企业资质），属高频驳回原因
  2. 申报类目为「管理」，与"年级+学科+课程资料"定位严重不符
- 修复（二选一）：
  - **A（推荐，保留个人主体）**：改为中性"个人学习记录"表述，去掉年级下拉与学科矩阵，去掉"课程资料"字眼，资源改名为"学习资料/笔记"
  - **B**：升级为企业主体，申报教育类目（需营业执照 + 可能办学许可）

### P0-4 教育类（含未成年人）投放广告 + 看广告解锁【平台规范】
- 命中：`pages/index/index.js:26-31`（开屏插屏）、`pages/resource-detail/resource-detail.js:49-55`（激励视频解锁资料）、`config/ad-config.js`、`utils/ad.js`、`app.js`（"积分不足，去看广告赚积分"文案）
- 问题：
  1. 面向未成年人的教育类小程序**禁止投放广告**
  2. 个人主体开通流量主需 ≥1000 UV，当前无广告位也会在审核时被判定"含广告能力"
  3. "看广告解锁内容"属于诱导广告互动
- 修复：提审前**下线全部广告代码与"看广告"相关文案**（ad-config.js、utils/ad.js、首页开屏、资料解锁逻辑、文案）

---

## 二、P1 · 高风险（强烈建议修）

### P1-1 诱导跳出微信外部浏览器
- 命中：`pages/resource-detail/resource-detail.js:73-78`「链接已复制，去浏览器打开」
- 问题：提示用户去外部浏览器打开，视为规避审核/外跳。改为站内 `web-view`（需业务域名）或原生渲染。

### P1-2 调试/埋点页进生产包
- 命中：`app.json:24` `pages/debug/telemetry`；`telemetry.js` 一键复制全部接口埋点 JSON
- 问题：调试页含内部接口信息，提审应为纯净包。建议移除该页与目录。

### P1-3 合法域名未落实 + urlCheck 掩盖
- 命中：`config/env.js` `CLOUD_RUN_PUBLIC_HOST`（`*.sh.run.tcloudbase.com`）用于 `wx.uploadFile` 与图片 `src`；`project.config.json:7` `urlCheck:false`
- 问题：`urlCheck:false` 在开发者工具里绕过了域名校验，但**真机/审核环境会强制校验**。需在公众平台配置 request / uploadFile / downloadFile 合法域名（云托管域名需加白）。提审前把 `urlCheck` 改回 `true` 自测。

### P1-4 生产配置占位符
- 命中：`config/env.js` `API_BASE:'https://你的备案域名.com'`
- 问题：当前 `USE_CLOUD_RUN=true` 未触发，但回退方案会失败。建议清理或标注。

---

## 三、P2 · 建议优化

- **P2-1** `app.js` `wx.getSystemInfoSync()` 已废弃 → 改 `wx.getWindowInfo/getDeviceInfo/getAppBaseInfo`（API 合规）
- **P2-2** `project.config.json` `packOptions.ignore` 为空，`preview/*.html`（含"积分商城（看广告赚积分）"字样）、`make_icons.py`、`minitest/`、`README.md` 全进包，与申报功能不符 → 加 ignore
- **P2-3** `sitemap.json` 全量 allow，`admin/*`、`debug/*` 被索引 → 改白名单

---

## 四、明确未发现风险（已交叉验证）

| 维度 | 结论 |
|------|------|
| 违规获取用户信息 | `getUserProfile/getUserInfo/getPhoneNumber/wx.authorize` 零命中，未私自获取昵称/头像/手机号 |
| 凭证外传 | `openid/session_key` 前端零命中；`wx.login` 的 code 仅发往自有后端 `/api/mp/auth/wx-login`，流程合规 |
| 第三方数据上报 | 埋点仅存内存，无任何第三方 SDK / 外部域名回传 |
| 支付 / 虚拟支付 | `requestPayment/支付/购买/下单/price` 零命中，无人民币购买、无积分兑实物、无分销发券 |
| 诱导分享 / 强制关注 | `onShareAppMessage/onShareTimeline/邀请/助力/集赞` 零命中 |
| 医药/保健品营销 | 小程序代码内零命中，无医疗功效宣传（注意：膏方营销风险在**后端/运营侧**，非小程序代码） |

---

## 五、提审前最小必做清单（P0 全做，否则必拒）

1. ☐ 移除 `pages/debug/telemetry` 页及 `app.json` 注册
2. ☐ 下线全部广告代码 + "看广告"文案（P0-4）
3. ☐ 接入 `msgSecCheck/imgSecCheck` + 举报删除（P0-1）
4. ☐ 配置隐私保护指引 + `app.json` 开 `__usePrivacyCheck__`（P0-2）
5. ☐ 去 K12 年级/学科表述，与"管理"类目对齐（P0-3）
6. ☐ 去掉外链"去浏览器打开"（P1-1）
7. ☐ 配齐 request/uploadFile/downloadFile 合法域名，`urlCheck` 改回 `true` 自测（P1-3）
8. ☐ 云托管 `WX_APP_ID` 改正式号 `wx64664e7fa8d4f747` + 重新部署（审核前置条件）

> 备注：第 3 项（内容安全）需在公众平台开通「内容安全」能力并配置密钥，后端 `server/src/routes/mp_*.js` 与小程序端均要加调用。
