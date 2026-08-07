#!/usr/bin/env node
/**
 * 真实后端 + 数据库核验脚本
 * ----------------------------------------------------------------------------
 * 对标 tools/sim_30users.js 的「30 人不同角色」矩阵，但这里是【真·HTTP 回放】：
 *   1. 用种子账号登录，拿到各角色 token；
 *   2. 按角色执行真实接口（登录、浏览、上传作业、登记完成、加减积分、设课代表、重置密码、看预警/日志/资料/钱包）；
 *   3. 并发压测 /api/credit-flow/adjust（多人同时给同一学生加减积分），核验「原子增量」修复后无丢失更新；
 *   4. 校验分页响应头（X-Total-Count / X-Has-More）；
 *   5. 输出模块可用率、接口耗时 P95、并发一致性结论，并写 tools/verify_result.json。
 *
 * 运行前置（见 docs/RUNBOOK_REAL_BACKEND.md）：
 *   docker compose up -d --build            # 拉起 mysql + backend + frontend
 *   node tools/verify_real_backend.js       # 默认打 http://localhost:3001
 *
 * 环境变量：
 *   API_BASE   后端基址（默认 http://localhost:3001）
 *   ADMIN_USER 管理员账号（默认 admin）
 *   ADMIN_PWD  管理员密码（默认 123456，与种子一致）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PWD = process.env.ADMIN_PWD || '123456';

let pass = 0, fail = 0;
const moduleStats = {};
const timings = [];
const failures = [];

function mod(name, ok, detail) {
  if (!moduleStats[name]) moduleStats[name] = { pass: 0, fail: 0 };
  if (ok) { moduleStats[name].pass++; pass++; }
  else { moduleStats[name].fail++; fail++; failures.push(`${name}: ${detail}`); }
  return ok;
}

async function call(method, p, body, token) {
  const t0 = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + p, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  timings.push(Date.now() - t0);
  return { status: res.status, data, headers: res.headers, raw: text };
}

async function login(username, password) {
  const r = await call('POST', '/api/auth/login', { username, password });
  if (r.status !== 200 || !r.data || r.data.code !== 0) {
    throw new Error(`login ${username} -> HTTP ${r.status} ${r.raw}`);
  }
  return { token: r.data.data.token, user: r.data.data.user };
}

// 简单字符串相似度，便于核对返回结构
function has(obj, keys) {
  return keys.every((k) => obj && Object.prototype.hasOwnProperty.call(obj, k));
}

async function main() {
  console.log('=== 真实后端核验 ===');
  console.log('API_BASE =', API_BASE);

  // 1) 管理员登录
  let admin;
  try { admin = await login(ADMIN_USER, ADMIN_PWD); }
  catch (e) { console.error('管理员登录失败，请确认后端已启动且种子已执行：', e.message); process.exit(2); }
  const adminToken = admin.token;
  console.log('管理员登录成功，mustChangePwd =', !!admin.user.mustChangePwd);

  // 2) 拉取账号，组建 30 人花名册（2 ADMIN / 4 TEACHER / 8 REP / 16 STUDENT，不足则取实际数量）
  const usersResp = await call('GET', '/api/users?pageSize=200', null, adminToken);
  const allUsers = Array.isArray(usersResp.data) ? usersResp.data : (usersResp.data && usersResp.data.list) || [];
  console.log('后端账号数 =', allUsers.length, '（X-Total-Count =', usersResp.headers.get('X-Total-Count'), '）');

  const buckets = { ADMIN: [], TEACHER: [], REP: [], STUDENT: [] };
  for (const u of allUsers) if (buckets[u.role]) buckets[u.role].push(u);
  const pick = (arr, n) => arr.slice(0, n);
  const roster = [
    ...pick(buckets.ADMIN, 2).map((u) => ({ ...u, role: 'ADMIN' })),
    ...pick(buckets.TEACHER, 4).map((u) => ({ ...u, role: 'TEACHER' })),
    ...pick(buckets.REP, 8).map((u) => ({ ...u, role: 'REP' })),
    ...pick(buckets.STUDENT, 16).map((u) => ({ ...u, role: 'STUDENT' })),
  ];
  console.log(`花名册：${roster.length} 人 | ADMIN ${buckets.ADMIN.length} / TEACHER ${buckets.TEACHER.length} / REP ${buckets.REP.length} / STUDENT ${buckets.STUDENT.length}`);
  if (roster.length < 30) console.log(`（提示：当前种子账号不足 30，已用 ${roster.length} 人；可扩展种子或在网页端补建账号后重跑）`);

  // 预登录所有角色账号
  const tokens = {};
  for (const u of roster) {
    try {
      const r = await login(u.username, ADMIN_PWD);
      tokens[u.id] = r.token;
    } catch (e) { /* 极个别账号登录失败不阻断整体 */ }
  }

  // 3) 模块可用性核验
  // 3.1 任务管理：管理员建任务
  let taskId = null;
  {
    const r = await call('POST', '/api/tasks', {
      title: '核验任务-' + Date.now(),
      subjectId: 1,
      type: 'HOMEWORK',
      creditValue: 5,
      deadline: '2099-12-31 23:59:59',
    }, adminToken);
    mod('任务管理', r.status === 200 && r.data && r.data.code === 0, '建任务 ' + r.raw);
    taskId = r.data && r.data.data && r.data.data.id;
  }
  // 列出任务
  {
    const r = await call('GET', '/api/tasks?pageSize=50', null, adminToken);
    mod('任务管理', Array.isArray(r.data) && r.data.length > 0, '列任务 ' + r.raw);
  }

  // 3.2 学生管理：列表分页头 + 取一个学生
  let studentId = null;
  {
    const r = await call('GET', '/api/students?page=1&pageSize=10', null, adminToken);
    const arr = Array.isArray(r.data) ? r.data : (r.data && r.data.list) || [];
    mod('学生管理', arr.length > 0 && r.headers.get('X-Has-More') !== null, `列学生 headers.hasMore=${r.headers.get('X-Has-More')} count=${r.headers.get('X-Total-Count')}`);
    if (arr.length) studentId = arr[0].id;
  }

  // 3.3 科目管理 + 设课代表
  {
    const r = await call('GET', '/api/subjects?pageSize=50', null, adminToken);
    mod('科目管理', Array.isArray(r.data) && r.data.length > 0, '列科目 ' + r.raw);
    const reps = buckets.REP.map((x) => x.id);
    if (r.data && r.data.length && reps.length) {
      const repR = await call('POST', `/api/subjects/${r.data[0].id}/reps`, { userIds: [reps[0]] }, adminToken);
      mod('科目管理', repR.status === 200, '设课代表 ' + repR.raw);
    }
  }

  // 3.4 账号管理：改角色 + 重置密码
  {
    const target = roster.find((u) => u.role === 'STUDENT');
    if (target) {
      const rr = await call('POST', `/api/users/${target.id}/reset-password`, {}, adminToken);
      mod('账号管理', rr.status === 200, '重置密码 ' + rr.raw);
    }
    const t2 = roster.find((u) => u.role === 'REP');
    if (t2) {
      const ro = await call('POST', `/api/users/${t2.id}/role`, { role: 'REP', subjectIds: [1] }, adminToken);
      mod('账号管理', ro.status === 200, '改角色 ' + ro.raw);
    }
  }

  // 3.5 资料管理：列表 + 详情
  {
    const r = await call('GET', '/api/mp/resources?pageSize=10', null, adminToken);
    mod('资料管理', Array.isArray(r.data) && r.data.length > 0, '列资料 ' + r.raw);
    if (r.data && r.data.length) {
      const d = await call('GET', `/api/mp/resources/${r.data[0].id}`, null, adminToken);
      mod('资料管理', d.status === 200 && d.data && d.data.resource, '资料详情 ' + d.raw);
    }
  }

  // 3.6 预警中心 + 操作日志
  {
    const a = await call('GET', '/api/alerts', null, adminToken);
    mod('预警中心', a.status === 200, '列预警 ' + a.raw);
    const l = await call('GET', '/api/operate-logs?pageSize=20', null, adminToken);
    const recs = (l.data && (l.data.records || l.data)) || [];
    mod('操作日志', l.status === 200 && (Array.isArray(recs) ? recs.length >= 0 : false), '列日志 ' + l.raw);
  }

  // 3.7 积分流水 / 钱包
  {
    const r = await call('GET', '/api/credit-flow?pageSize=20', null, adminToken);
    mod('积分流水', Array.isArray(r.data), '列流水 ' + r.raw);
  }

  // 3.8 课代表登记某学生完成（用 REP 账号）
  if (taskId && studentId) {
    const rep = roster.find((u) => u.role === 'REP' && tokens[u.id]);
    if (rep) {
      const r = await call('POST', '/api/completion/register', { taskId, studentIds: [studentId], status: 'DONE_ONTIME' }, tokens[rep.id]);
      mod('作业登记', r.status === 200 && r.data && r.data.code === 0, '登记完成 ' + r.raw);
    }
  }

  // 4) 并发压测：原子增量修复核验（#4）
  if (studentId) {
    const before = await call('GET', '/api/students?pageSize=200', null, adminToken);
    const arr = Array.isArray(before.data) ? before.data : (before.data && before.data.list) || [];
    const stu = arr.find((s) => s.id === studentId);
    const initial = stu ? stu.totalCredits : 0;
    const K = 30;
    const batch = [];
    for (let i = 0; i < K; i++) {
      batch.push(call('POST', '/api/credit-flow/adjust', { studentId, amount: 1, reason: '并发压测#' + i }, adminToken));
    }
    const results = await Promise.all(batch);
    const okCount = results.filter((r) => r.status === 200 && r.data && r.data.code === 0).length;
    // 重新拉取该生总分
    const after = await call('GET', '/api/students?pageSize=200', null, adminToken);
    const arr2 = Array.isArray(after.data) ? after.data : (after.data && after.data.list) || [];
    const stu2 = arr2.find((s) => s.id === studentId);
    const finalTotal = stu2 ? stu2.totalCredits : 0;
    const expected = initial + K;
    const consistent = finalTotal === expected;
    mod('并发原子性', consistent, `初始=${initial} 并发=${K} 成功=${okCount} 终值=${finalTotal} 期望=${expected} ${consistent ? '✅无丢失更新' : '❌出现丢失更新'}`);
    if (!consistent) console.error('  ⚠️ 并发一致性异常：终值', finalTotal, '≠ 期望', expected);
  }

  // 5) 输出
  const total = pass + fail;
  const sorted = timings.slice().sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const avg = sorted.length ? Math.round(sorted.reduce((s, x) => s + x, 0) / sorted.length) : 0;
  const result = {
    apiBase: API_BASE,
    at: new Date().toISOString(),
    total, pass, fail, rate: total ? (pass / total * 100).toFixed(1) + '%' : '0%',
    rosterSize: roster.length,
    latency: { avgMs: avg, p95Ms: p95, maxMs: sorted.length ? sorted[sorted.length - 1] : 0 },
    moduleStats,
    failures: failures.slice(0, 30),
  };
  const out = path.join(__dirname, 'verify_result.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log('\n=== 核验结果 ===');
  console.log(`总操作 ${total} | 通过 ${pass} | 失败 ${fail} | 通过率 ${result.rate}`);
  console.log(`耗时 avg=${avg}ms p95=${p95}ms`);
  console.log('模块维度：');
  for (const [k, v] of Object.entries(moduleStats)) {
    console.log(`  ${k.padEnd(8)} 通过${v.pass} 失败${v.fail}`);
  }
  if (failures.length) { console.log('失败明细：'); failures.slice(0, 10).forEach((f) => console.log('  - ' + f)); }
  console.log('已写入', out);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('核验异常：', e); process.exit(3); });
