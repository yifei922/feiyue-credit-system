# 微信云托管 · 环境变量填写清单（完整版，全部已填好 ✅）

> 用法：云托管控制台 → 服务列表 → 点 **express-fzw2** → **服务设置** → **环境变量** → 逐条「新增」。
> 变量名和值都**原样复制**，不要带引号、不要有空格。
> 填完后必须点**保存/重新部署**才生效！

---

## 你的部署信息

| 项目 | 值 |
|------|-----|
| 环境 ID | `prod-d8gu13a84a2b62eed` |
| 服务名 | `express-fzw2` |
| 公网域名 | `https://express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com` |
| 小程序 AppID | `wx0fe78d74fdc47c1b` |
| MySQL 内网地址 | `10.18.108.46:3306` |

---

## A. 必填变量（11 条）—— 全部已填好，直接复制 👇

### ① 微信相关（3 条）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `WX_APP_ID` | `wx0fe78d74fdc47c1b` | 你项目的 AppID |
| `WX_APP_SECRET` | `ce5289a2b7ebd51a2d86a45fe83cb0f8` | ⚠️ 只显示一次，已帮你存好 |
| `JWT_SECRET` | `283edceb3774a3230c225574ae379d8d334aa155994713d3732f26fe75c1207f` | 随机生成，勿外泄 |

### ② 数据库相关（5 条）

> ⚠️ 你的控制台已经有 `MYSQL_ADDRESS` / `MYSQL_USERNAME` / `MYSQL_PASSWORD`（平台模板自带的），
> **不用删它们**。下面这些 `DB_*` 是我们代码读的，两套同时存在互不影响。

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DB_HOST` | `10.18.108.46` | MySQL 内网 IP（从你的 MYSQL_ADDRESS 拆出来的） |
| `DB_PORT` | `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | `Xpm8swMt` | 你设的密码 |
| `DB_NAME` | `credit` | 数据库名（首次启动自动建表+种子数据） |

### ③ 运行环境（3 条）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产模式 |
| `INIT_POINTS` | `100` | 新用户初始积分 |
| `RESOURCE_VIEW_COST` | `5` | 查看资料消耗积分 |

> `PORT` 不用填 —— Dockerfile 已内置 `PORT=80`。

---

## B. 控制台已有的（平台模板自动生成的，确认即可）

你截图里已经有的这几条，**保留不动**：

| 变量名 | 值 | 来源 |
|--------|-----|------|
| `COS_BUCKET` | `7072-prod-d8gu13a84a2b62eed-...` | 平台自动生成 |
| `COS_REGION` | `ap-shanghai` | 平台自动生成 |
| `MYSQL_ADDRESS` | `10.18.108.46:3306` | 你填的（或平台生成） |
| `MYSQL_USERNAME` | `root` | 你填的 |
| `MYSQL_PASSWORD` | `Xpm8swMt` | 你填的 |

---

## C. 可选（一般不用填）

| 变量名 | 默认 | 什么时候要填 |
|--------|------|-------------|
| `DB_SSL` | 关闭 | 用**外网地址**连腾讯云 MySQL 时填 `1` |
| `DB_POOL_SIZE` | `10` | 并发很高时调大 |
| `TOKEN_EXPIRES` | `12h` | 想改登录有效期时 |

---

## D. 操作步骤（按这个顺序来）

```
① 打开：mp.weixin.qq.com → 左侧「开发」→「云托管」→ 服务列表 → 点 express-fzw2
    ↓
② 点「服务设置」→ 找到「环境变量」区域
    ↓
③ 对照上面的 A 表，逐条点「+」新增：
   - 先加 WX_APP_ID / WX_APP_SECRET / JWT_SECRET（3 条）
   - 再加 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME（5 条）
   - 最后加 NODE_ENV / INIT_POINTS / RESOURCE_VIEW_COST（3 条）
    ↓
④ 确认 B 表里的 MYSQL_* 三条还在（如果在就别动）
    ↓
⑤ 点页面底部的「保存」或「更新」按钮
    ↓
⑥ ⚠️ 改完环境变量后必须「重新部署」一次！
   找「版本管理」→「新建版本」→ 触发重新构建部署
    ↓
⑦ 等部署完成（通常 2~5 分钟），状态变「运行中」
    ↓
⑧ 回到本地微信开发者工具：
   - 把 miniprogram/config/env.js 里 IS_PROD 改成 true
   - 点「编译」→ 用 student01 / 123456 登录测试
```

---

## E. 小程序侧配置（已由我改好 ✅）

文件：`miniprogram/config/env.js`

```js
const IS_PROD = false;          // ← 第⑧步时改成 true（就这一个字！）

const PROD = {
  USE_CLOUD_RUN: true,
  CLOUD_RUN_ENV: 'prod-d8gu13a84a2b62eed',
  CLOUD_RUN_SERVICE: 'express-fzw2',
  CLOUD_RUN_PUBLIC_HOST: 'express-fzw2-294081-6-1465570426.sh.run.tcloudbase.com',
};
```

---

## F. 常见问题

**Q：填完环境变量还是连不上数据库？**
A：确认你改完环境变量后点了「重新部署」。只保存不重建容器不会生效。

**Q：提示 "ECONNREFUSED" 或 "Connection refused"？**
A：检查 `DB_HOST` 是内网地址（`10.x.x.x`）不是外网地址。云托管和 MySQL 在同一 VPC 内网才能互通。

**Q：提示 "Access denied"？**
A：核对 `DB_USER` 和 `DB_PASSWORD` 和你在腾讯云控制台创建 MySQL 时设的一致。注意密码区分大小写。

**Q：WX_APP_SECRET 填错了怎么办？**
A：回公众平台 → 开发设置 → 点「重置」→ 重新扫码拿新的 → 回来这里更新环境变量 → 重新部署。
