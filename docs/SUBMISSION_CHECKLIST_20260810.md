# feiyue-credit 微信小程序提审自查清单

> 适用版本：commit `f53f47a` 之后 · 个人主体 · 食养/兴趣类（非 K12 学科类）
> 配套整改报告：`docs/PROD_QA_REPORT_20260810.md`（4 P0 + 12 P1 + 7 P2 已修）
> 配套审计报告：`docs/AUDIT_REPORT_20260810.md`

照着打钩就不会漏。**每一项必须亲眼确认**，不要"应该差不多吧"。

---

## 一、代码侧（已自动完成 ✅，仅供核对）

- [x] `miniprogram/app.json` — 删除 `permission.scope.userLocation`（无用声明）
- [x] `miniprogram/app.json` — `requiredPrivateInfos` 仅留 `chooseMedia/setClipboardData/getClipboardData`
- [x] `miniprogram/app.json` — `__usePrivacyCheck__: true`
- [x] `miniprogram/app.json` — 已注册 `pages/admin/reports`
- [x] `pages/admin/resources.*` — SUBJECTS/grade 已改兴趣/通用标签
- [x] `server/src/routes/mp_content.js` — 举报表 `AUTO_INCREMENT` 正确；安检故障返 503
- [x] `server/src/routes/mp_feed.js` — `submit.js` 路径 `/api/completion/register` 正确；发帖图走 `imgSecCheck`
- [x] `server/src/lib/wx.js` — `getAccessToken/msgSecCheck/imgSecCheck` 已实现
- [x] `server/src/db.js` — `normalizeK12ToNeutral()` 一次性迁移已就位
- [x] `server/.env` — `WX_APP_ID=wx64664e7fa8d4f747`、`WX_APP_SECRET=...`（gitignore，不入库）

---

## 二、你必须手动做的（控制台操作）— 按顺序执行

### 阶段 1：等隐私指引审核通过

- [ ] **1.1** 打开 `mp.weixin.qq.com`
- [ ] **1.2** 左下角点头像 → **账号设置** → **服务内容声明** → 用户隐私保护指引
- [ ] **1.3** 确认勾选 4 项：✅ 相册（图片/视频/文件） ✅ 摄像头 ✅ 剪贴板 ✅ 文件
- [ ] **1.4** 确认 **未勾** 用户信息、位置信息
- [ ] **1.5** 提交后等 **2~5 小时**，状态变"已通过"再进行下一步

> ⚠️ 提审前**必须**等这一步通过，否则代码会被驳回。

### 阶段 2：上传小程序代码

- [ ] **2.1** 打开微信开发者工具，确认 AppID 是 `wx64664e7fa8d4f747`（非测试号）
- [ ] **2.2** 顶部菜单点 **上传**（快捷键 `Ctrl+Shift+U`）
- [ ] **2.3** 弹出窗填：
   - 版本号：`1.0.1`
   - 项目备注：`生产环境整改-隐私合规+功能优化`
- [ ] **2.4** 点 **上传** → 等待"已上传到微信公众平台"提示

### 阶段 3：提交审核（关键！）

- [ ] **3.1** 打开 `mp.weixin.qq.com` → 左侧 **管理** → **版本管理**
- [ ] **3.2** 找到刚才上传的版本，点 **提交审核**
- [ ] **3.3** 弹出表单填写类目（按实际选"工具/教育/其他"）
- [ ] **3.4** ⚠️ **页面底部找「用户隐私保护指引设置」一栏，确认显示"已配置"**
- [ ] **3.5** ⚠️ **找「采集用户隐私」勾选项，必须勾上**
- [ ] **3.6** 点 **提交审核** → 等待审核结果（一般 1~3 天）

> ⚠️ 这一步是踩坑高频点：**没勾"采集用户隐私"= 隐私接口线上调不了**。

### 阶段 4：审核通过 + 发布上线

- [ ] **4.1** 审核状态变"审核通过"后，回到 **版本管理**
- [ ] **4.2** 点 **发布** → 线上生效
- [ ] **4.3** 立即真机扫码验证：
   - 头像选择、相册选图、拍照、复制链接 — 四个功能必须能调
   - 任一个失败 → 回到阶段 1 检查是否漏配

### 阶段 5：服务端部署（与上面并行，可同步做）

- [ ] **5.1** 打开云托管控制台 → 选环境 `express-fzw2`
- [ ] **5.2** **环境变量** 一栏，确认有：
   - `WX_APP_ID=wx64664e7fa8d4f747`
   - `WX_APP_SECRET=de8898c3212be995d07661294158c57a`（建议公众平台重置后换成新值）
- [ ] **5.3** **服务管理** → **上传代码** → 上传 `dist/server-cloudrun.zip`
- [ ] **5.4** 部署完成后访问 `https://你的服务域名/api/health`，确认返回 `{"ok":true}`

---

## 三、提审后被驳回的常见原因（自查对照）

| 驳回原因 | 你这边是否触发 | 自查动作 |
|---|---|---|
| 涉及 K12 学科培训 | ❌ 已整改（兴趣/通用标签） | 检查 `admin/resources.*` 与 `seed_resources.js` |
| 教育类激励广告 | ❌ 已删广告 | 检查 `pages/feed`、`pages/index` 无广告 SDK |
| 未配置隐私保护指引 | ✅ 已配置 | 阶段 1 已确认 |
| 未勾选"采集用户隐私" | ⚠️ 必须勾 | 阶段 3.5 重点 |
| 内容安全（UGC 文本/图片） | ✅ 服务端已接入 | 阶段 5 部署新 zip |
| 测试号 AppID | ✅ 已修正 | 阶段 2.1 确认 |
| 服务器域名用了 `.sh.run.tcloudbase.com` | ✅ 不需要 | **服务器域名一栏全部留空**（callContainer 走内部通道） |
| 头像/昵称/手机号授权违规 | ✅ 未触发（getUserProfile 未调） | 已核查 |

---

## 四、长期建议（提审上线后择机处理）

- [ ] **轮换 AppSecret**：去 `mp.weixin.qq.com` → 开发 → 开发管理 → **重置 AppSecret** → 新值配到云托管环境变量 → 删 `docs/cloudrun-env.json` 中旧值 → git 重新提交（密钥彻底脱离 git 历史）
- [ ] **清理 `miniprogram/preview/index_new.html` 等调试产物**（git 状态里的 untracked 文件）
- [ ] **删除 `server/src/db.js` 的 K12 迁移函数**（线上跑过一次后可下，保留也无害）

---

## 五、紧急回滚（万一线上出问题）

```bash
# 1. 云托管控制台：切回上一版本（version 005 或之前）
# 2. 公众平台：撤回审核/紧急下架
# 3. Git 回滚
cd C:/Users/20242/WorkBuddy/feiyue-credit
GIT_OPTIONAL_LOCKS=0 git revert HEAD --no-edit
GIT_OPTIONAL_LOCKS=0 git push origin master
```

---

**清单版本**：2026-08-10 18:50
**适用 commit**：`f53f47a`（chore: 清理 app.json 冗余声明）
**配套文档**：`docs/PROD_QA_REPORT_20260810.md` · `docs/AUDIT_REPORT_20260810.md`