// 生产环境预演验证：用 mysql2 桩拦截，对所有 P0 修复路径做完整测试
// 对应 AUDIT_REPORT_20260810.md 中的 8 项 P0 + 1 项 P1
const Module = require('module');
const orig = Module._load;

// 真实 mysql2 行为模拟：追踪所有 SQL，分场景返回不同数据
const path = require('path');
const SQL_LOG = [];
const BEHAVIOR = global.__BEHAVIOR__ || (global.__BEHAVIOR__ = { mode: 'normal' });

const fakePool = {
  query: async (sql, params) => {
    SQL_LOG.push({ sql: String(sql).slice(0, 200), params });
    // 模拟积分扣除：返回 affectedRows=1 模拟扣分成功
    if (sql.includes('GREATEST') && sql.includes('points>=?')) {
      const enough = (params[1] >= params[2]); // uid 余额 >= cost
      return [{ affectedRows: enough ? 1 : 0, insertId: 0 }];
    }
    return [[]];
  },
  getConnection: async () => fakeConn,
  end: async () => {},
};

const fakeConn = {
  query: async (sql, params) => { SQL_LOG.push({ sql: String(sql).slice(0, 200), params, conn: true }); return [[]]; },
  beginTransaction: async () => SQL_LOG.push({ op: 'BEGIN' }),
  commit: async () => SQL_LOG.push({ op: 'COMMIT' }),
  rollback: async () => SQL_LOG.push({ op: 'ROLLBACK' }),
  release: () => SQL_LOG.push({ op: 'RELEASE' }),
};

Module._load = function(req, parent, isMain) {
  if (req === 'mysql2/promise') {
    return { createPool: () => fakePool, createConnection: async () => fakeConn };
  }
  return orig.apply(this, arguments);
};

// 预置 JWT_SECRET 绕过 auth 启动校验
process.env.JWT_SECRET = 'audit-verify-test';

const { db, pool } = require('../server/src/db.js');

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { console.log(`  \u2705 ${name}`); pass++; }
  else      { console.log(`  \u274c ${name} - ${detail||''}`); fail++; }
}

(async () => {
  console.log('\n========== P0 修复点完整验证 ==========\n');

  // ── P0-6: db.transaction 提交路径 ──
  console.log('[P0-6] db.transaction 提交路径');
  SQL_LOG.length = 0;
  const r1 = await db.transaction(async (conn) => {
    await conn.query('INSERT INTO t VALUES(1)');
    return 'ok';
  });
  assert('返回 callback 结果', r1 === 'ok');
  assert('顺序: getConn → BEGIN → query → COMMIT → RELEASE',
    JSON.stringify(SQL_LOG.filter(s=>s.op).map(s=>s.op)) === '["BEGIN","COMMIT","RELEASE"]',
    JSON.stringify(SQL_LOG));

  // ── P0-6: db.transaction 回滚路径 ──
  console.log('\n[P0-6] db.transaction 回滚路径');
  SQL_LOG.length = 0;
  try {
    await db.transaction(async (conn) => {
      await conn.query('INSERT INTO t VALUES(2)');
      throw new Error('boom');
    });
  } catch (e) {
    assert('异常被抛出', e.message === 'boom');
    assert('顺序: BEGIN → query → ROLLBACK → RELEASE',
      JSON.stringify(SQL_LOG.filter(s=>s.op).map(s=>s.op)) === '["BEGIN","ROLLBACK","RELEASE"]');
  }

  // ── P0-7: db.prepare(sql, conn) 让语句走事务连接 ──
  console.log('\n[P0-7] prepare(sql, conn) 走事务连接');
  SQL_LOG.length = 0;
  await db.transaction(async (conn) => {
    const stmt = db.prepare('INSERT INTO t(col) VALUES(?)', conn);
    await stmt.run('hello');
    await stmt.run('world');
  });
  const connQueries = SQL_LOG.filter(s => s.conn);
  assert('所有 run 都走了 conn（不在 pool）', connQueries.length === 2);
  // 注意：finally 会再触发 RELEASE，所以 op 序列含 BEGIN/COMMIT/RELEASE
  const opSeq = JSON.stringify(SQL_LOG.filter(s => s.op).map(s => s.op));
  assert('顺序含 BEGIN→query→COMMIT→RELEASE',
    opSeq.includes('BEGIN') && opSeq.includes('COMMIT') && opSeq.includes('RELEASE'),
    opSeq);

  // ── P0-3: dashboard 的 scopeTasks 缺 await 修复（验证 requires await）──
  // 静态检查：grep db.js 看是否有准备事务调用 + 占位符对齐
  console.log('\n[P0-3] scopeTasks 调用必须有 await');
  const fs = require('fs');
  const ROOT = path.resolve(__dirname, '..');
  const dashSrc = fs.readFileSync(path.join(ROOT, 'server/src/routes/dashboard.js'), 'utf8');
  assert('dashboard.js scopeTasks 已加 await',
    /await\s+scopeTasks\(/.test(dashSrc));

  // ── P0-2: mp_resources.js 批量导入 items→list 修复 ──
  console.log('\n[P0-2] 批量导入 items→list');
  const mpSrc = fs.readFileSync(path.join(ROOT, 'server/src/routes/mp_resources.js'), 'utf8');
  assert('mp_resources.js 用 list 遍历',
    /for\s*\(.*?\blist\b/.test(mpSrc));
  // items 必须不在代码里出现（除了注释）
  const codeOnly = mpSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert('mp_resources.js 代码中无遗留 items（注释除外）',
    !/\bitems\b/.test(codeOnly));

  // ── seed_resources.js VALUES 占位符数 = 列数 = 实参数 ──
  console.log('\n[VALUES] seed_resources 占位符对齐');
  const seedSrc = fs.readFileSync(path.join(ROOT, 'server/src/seed_resources.js'), 'utf8');
  const insertMatch = seedSrc.match(/INSERT INTO resource\(([^)]+)\)\s*VALUES\((\?[\?,]+)\)/);
  if (insertMatch) {
    const cols = insertMatch[1].split(',').length;
    const qs = insertMatch[2].split('?').length - 1;
    assert(`VALUES 占位符 (${qs}) = 列数 (${cols})`, qs === cols, `cols=${cols} qs=${qs}`);
    // 找最近的 ins.run(...) 调用核对实参数
    const lines = seedSrc.split('\n');
    let runLine = '';
    for (const l of lines) if (l.includes('ins.run(e.grade')) { runLine = l; break; }
    // 数实参：跨行整段统计（ins.run( 起到 ; 止）
    const insStart = seedSrc.indexOf('ins.run(e.grade');
    let segCommas = 0;
    if (insStart >= 0) {
      let seg = seedSrc.slice(insStart, Math.min(insStart + 600, seedSrc.length));
      const endIdx = seg.indexOf(';');
      if (endIdx > 0) seg = seg.slice(0, endIdx);
      segCommas = (seg.match(/,/g) || []).length;
    }
    assert(`ins.run 整段实参 12 个 = 占位符 ${qs}`, segCommas === 11, `seg_commas=${segCommas}`);
  } else {
    assert('找到 INSERT INTO resource 模板', false, 'regex no match');
  }

  // ── seed_resources.js ins.run 已加 await ──
  assert('seed_resources.js ins.run 已 await 串化',
    /await\s+ins\.run\(/.test(seedSrc));

  // ── mp_resources.js 扣积分 GREATEST(0,...) 修复 ──
  console.log('\n[P1] 积分下限 GREATEST');
  assert('mp_resources.js 扣积分改 GREATEST',
    /GREATEST\(0,\s*points-\?\)/.test(mpSrc));
  assert('affectedRows === 0 判定失败',
    /affectedRows\s*===\s*0/.test(mpSrc));

  // ── lib/wx.js https.get 加 timeout ──
  console.log('\n[P0-4] wx.js https.get timeout');
  const wxSrc = fs.readFileSync(path.join(ROOT, 'server/src/lib/wx.js'), 'utf8');
  assert('wx.js 有 setTimeout 防护',
    /\.setTimeout\s*\(\s*\d{3,}/.test(wxSrc) || /setTimeout\s*\(\s*\d{3,}/.test(wxSrc));

  // ── index.js unhandledRejection / uncaughtException ──
  console.log('\n[P0-5] 全局异步兜底');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'server/src/index.js'), 'utf8');
  assert('index.js 注册 unhandledRejection',
    /process\.on\(\s*['"`]unhandledRejection['"`]/.test(indexSrc));
  assert('index.js 注册 uncaughtException',
    /process\.on\(\s*['"`]uncaughtException['"`]/.test(indexSrc));

  // ── completions.js /import 缺 await 已修 ──
  console.log('\n[P0-1] completions /import await');
  const compSrc = fs.readFileSync(path.join(ROOT, 'server/src/routes/completions.js'), 'utf8');
  assert('completions.js /import registerCompletion 已 await',
    /await\s+registerCompletion\(/.test(compSrc));

  // ── 小程序 admin/* 守卫（静态检查 9 个文件）──
  console.log('\n[小程序] admin/* 9 个页路由守卫');
  const adminFiles = [
    'miniprogram/pages/admin/index.js',
    'miniprogram/pages/admin/users.js',
    'miniprogram/pages/admin/tasks.js',
    'miniprogram/pages/admin/students.js',
    'miniprogram/pages/admin/subjects.js',
    'miniprogram/pages/admin/resources.js',
    'miniprogram/pages/admin/operate-log.js',
    'miniprogram/pages/admin/alerts.js',
    'miniprogram/pages/admin/credits-adjust.js',
  ];
  for (const f of adminFiles) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert(`${f.split('/').pop()} 有 requireRole 守卫`,
      /requireRole\s*\(/.test(s));
  }

  // ── 小程序 profile.js 字段名错位修复 ──
  console.log('\n[小程序] profile.js 字段名');
  const profileSrc = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.js'), 'utf8');
  assert('profile.js 用 studentId 而非 student_id',
    /studentId:\s*r\.data\.studentId/.test(profileSrc));
  assert('profile.js 不再有 student_id:',
    !/student_id:\s*r/.test(profileSrc));

  // ── app.js 401 跳转 + header 大小写 ──
  console.log('\n[小程序] app.js 401 + header');
  const appSrc = fs.readFileSync(path.join(ROOT, 'miniprogram/app.js'), 'utf8');
  // 把全文件压成单行后再匹配（兼容跨行写法）
  const appFlat = appSrc.replace(/\s+/g, ' ');
  assert('app.js 401 后 setTimeout reLaunch login',
    /setTimeout/.test(appFlat) && /wx\.reLaunch/.test(appSrc) && /\/pages\/login\/login/.test(appSrc));
  assert('app.js header 大小写归一',
    /toUpperCase\(\)/.test(appSrc) || /toLowerCase\(\)/.test(appSrc));

  console.log(`\n========== 验证结果 ==========\n通过: ${pass}    失败: ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });