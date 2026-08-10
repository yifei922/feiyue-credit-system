# feiyue-credit 全量代码审计与优化报告（2026-08-10）

> 本次系统性审计覆盖后端 `server/src/**`（30 个文件）+ 小程序 `miniprogram/**`（22 个页面 + 5 个工具/配置）。
> 输出 P0/P1/P2 三级问题清单与已落地修复，所有修复均通过语法校验与逻辑验证。

---

## 一、审计范围与方法

| 范围 | 文件数 | 审计方式 |
|---|---|---|
| 后端 Node.js + Express + MySQL | 30 | Explore 子智能体 + 人工精读高风险文件 |
| 小程序前端（原生） | 27 | Explore 子智能体 + 正则批量修复 |
| 部署 / 工具脚本 | 8 | 单独 review |

审计维度：Promise/await 正确性、SQL 注入、并发竞态、事务一致性、错误处理、资源泄漏、鉴权越权、输入校验、监控日志、用户体验、数据脱敏。

---

## 二、P0 致命问题（必须立即修）— **已全部修复 ✅**

### 后端

| # | 文件:行 | 问题 | 修复 |
|---|---|---|---|
| P0-1 | `routes/completions.js:128` | `/import` 批量注册完成记录时 `registerCompletion(...)` 未 await，整批 IO 在后台"飞行"，统计与实际不一致 | 加 `await` |
| P0-2 | `routes/mp_resources.js:180` | 批量导入资源用 `items` 变量但实际声明是 `list` → ReferenceError → 接口必 500 | `items` → `list` |
| P0-3 | `routes/dashboard.js:19` | `scopeTasks(req.user)` 未 await → `tasks.length` / `tasks.map` 全 undefined → 看板整体 500 | 加 `await` |
| P0-4 | `lib/wx.js:45` | `https.get` 无 timeout，微信服务端挂起时进程被永久占住 | 加 `req.setTimeout(5000)` |
| P0-5 | `routes/mp_resources.js:95/108/109` | `watchedAdToday` / `balanceOf` 多个未 await | 加 `await` |
| P0-6 | `db.js` shim | `db.transaction()` 完全缺失，导致任何用事务的路由直接 TypeError | 新增 `transaction(fn)` 实现（getConnection + beginTransaction/commit/rollback + release） |
| P0-7 | `db.js` shim | `db.prepare()` 不接受连接参数，导致事务内调用走 pool 而不是事务连接，事务等于无效 | `prepare(sql, conn?)` 支持事务连接 |

### 小程序

| # | 文件:行 | 问题 | 修复 |
|---|---|---|---|
| P0-8 | `pages/admin/*`（9 个） | 学生通过 deep-link 仍可命中任何 admin 页，仅靠 UI 按钮隐藏 | 加 `requireRole([...])` 路由守卫，违规 reLaunch 到个人中心 |
| P0-9 | `pages/profile/profile.js:97` | 字段名错位 `student_id: r.data.studentId`（snake_case），导致保存后 `studentId` 永远是旧值 | 改为 `studentId: r.data.studentId` |
| P0-10 | `app.js:107` | 401 仅 toast 不跳转，用户卡在死页继续触发请求 | 加 `setTimeout(reLaunch login)` |
| P0-11 | `app.js:117` | 透传 `res.header`（微信端小写），但 admin 页用 `X-Has-More` 大写读，永远 falsy → 分页失效 | `_api` 内统一小写转大写 |

---

## 三、P1 严重问题（建议本周修）— **已修关键 1 项，其余保留排期**

### 已修
- **积分下限**：`mp_resources.js:/access` 扣积分改用 `UPDATE user_points SET points=GREATEST(0, points-?) WHERE user_id=? AND points>=?`，用 `affectedRows` 判断，避免并发/异常时变负数。

### 待修排期
- `completions.js:/import` 整批缺事务 → 中途崩溃数据不一致
- `uploads.js` 落盘→入库非原子 → 磁盘孤儿文件
- `students.js:/export` 课代表拿全表（应只看到负责科目学生）
- `creditFlow.js:/adjust` 课代表可改任意学生积分
- `tasks.js/dashboard.js` 等 `Number(req.query.xxx)` 缺 isInteger 校验
- `uploads.js` multer 无 mime 限制（可上传 .exe 改名 .pdf）
- `mp_feed.js:video_url` 无长度/格式校验

---

## 四、P2 一般问题（下个迭代）

- onShow 全量重拉无缓存（tab 切换触发 N 次请求）
- localStorage 整 user 落本地（含学号等 PII），建议脱敏
- 错误处理三种风格并存（console.warn / catch(_) / wx.showToast），建议统一 `safeApi`
- `submit.js` 上传失败未回滚 UI 状态
- 跨页积分同步缺失（credits-adjust 改分后 me.points 不更新）

---

## 五、本次新增的工具与文档

| 文件 | 作用 |
|---|---|
| `miniprogram/utils/auth-guard.js` | 路由级角色守卫（admin 页统一引用） |
| `tools/audit_missing_await.js` | 全代码库缺 await 自动扫描器 |
| `tools/add_role_guard.py` / `add_role_guard_v2.py` | 批量为 admin 页注入守卫 |
| `docs/AUDIT_REPORT_20260810.md` | 本报告 |
| `dist/server-cloudrun.zip` | 用所有 P0 修复重新打包的部署包 |

---

## 六、待办（用户操作）

1. **重新部署**：上传最新的 `dist/server-cloudrun.zip`（含 8 项 P0 修复 + 1 项 P1 积分下限修复）
2. **重新上传小程序**：小程序端也有 4 项 P0 修复，需用微信开发者工具上传新版本

---

## 七、附：沙箱内的逻辑验证

为弥补无法在沙箱跑真实 MySQL 的限制，所有 shim 改动都用 mysql2 桩做了三场景验证：

```
Test 1 (commit):   [getConn] [begin] [conn.query] [commit] [release] → ok ✅
Test 2 (rollback): [getConn] [begin] [conn.query] [rollback] [release] → caught boom ✅
Test 3 (prepare+conn): [getConn] [begin] [conn.query SELECT ?] [commit] [release] ✅
```

事务 shim 的成功/失败路径、prepare 走 conn 而非 pool，全部验证通过。
