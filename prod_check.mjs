const BASE = 'https://feiyue-credit.onrender.com';
const log = (...a) => console.log(...a);
const ok = (c) => (c >= 200 && c < 300 ? '✅' : '❌');

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  return { status: r.status, token: j?.data?.token, user: j?.data?.user, raw: j };
}

async function api(path, token, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { data = await r.text(); }
  return { status: r.status, data };
}

async function run() {
  log('========== 生产环境端到端检验 ==========');
  log('BASE:', BASE);

  // 1. 各角色登录
  const accounts = [
    ['admin', '123456'],
    ['teacher01', '123456'],
    ['rep01', '123456'],
    ['rep02', '123456'],
    ['stu01', '123456'],
    ['stu06', '123456'],
    ['superadmin', 'Feiyue@2026'],
  ];
  const tokens = {};
  log('\n--- 1. 角色登录 ---');
  for (const [u, p] of accounts) {
    const { status, token, user } = await login(u, p);
    tokens[u] = token;
    log(`${ok(status)} ${u.padEnd(10)} ${status}  role=${user?.role || '-'}  name=${user?.name || '-'}`);
  }

  // 2. 动态科目（应 13 门初中全科）
  log('\n--- 2. 动态科目列表 ---');
  const sub = await api('/api/subjects', tokens.admin);
  const names = (sub.data?.data || sub.data || []).map(x => x.name);
  log(`${ok(sub.status)} /api/subjects ${sub.status}  共 ${names.length} 门: ${names.join('、')}`);

  // 3. 看板完成小计
  log('\n--- 3. 数据看板·完成小计 ---');
  const sum = await api('/api/dashboard/completion-summary', tokens.admin);
  const s = sum.data?.data || sum.data || {};
  log(`${ok(sum.status)} /api/dashboard/completion-summary ${sum.status}`);
  log('   totalStudents=' + s.totalStudents + '  done=' + s.doneStudents + '  unfinished=' + s.unfinishedStudents);
  log('   byTask 条数=' + (s.byTask?.length || 0) + '  unfinishedList 条数=' + (s.unfinishedList?.length || 0));

  // 4. 账号管理（老师/管理员可见）
  log('\n--- 4. 账号列表 (admin) ---');
  const users = await api('/api/users', tokens.admin);
  const ul = users.data?.data || users.data || [];
  log(`${ok(users.status)} /api/users ${users.status}  账号数=${ul.length}`);
  const reps = ul.filter(u => u.role === 'REP');
  log('   其中课代表(REP)数=' + reps.length + '  ' + reps.map(r => r.username + (r.subjectNames?.length ? '(' + r.subjectNames.join(',') + ')' : '')).join(' '));

  // 5. 学分手动增减（admin 给学生 stu01 加 5 分）
  log('\n--- 5. 学分手动增减 ---');
  // 先查 stu01 对应的 student id
  const stuList = await api('/api/students', tokens.admin);
  const sl = stuList.data?.data || stuList.data || [];
  const target = sl.find(s => s.studentNo === 'stu01') || sl[0];
  log('   目标学生: ' + (target?.name) + ' (id=' + target?.id + ', 当前学分=' + target?.totalCredits + ')');
  if (target) {
    const adj = await api('/api/credit-flow/adjust', tokens.admin, {
      method: 'POST',
      body: { studentId: target.id, amount: 5, reason: '生产环境端到端检验-加分' },
    });
    log(`${ok(adj.status)} POST /api/credit-flow/adjust ${adj.status}  ` + JSON.stringify(adj.data?.data || adj.data));
    // 复原：-5
    await api('/api/credit-flow/adjust', tokens.admin, {
      method: 'POST',
      body: { studentId: target.id, amount: -5, reason: '生产环境端到端检验-回退' },
    });
    log('   已回退 -5 分（保持数据原状）');
  }

  // 6. 一键提醒未完成
  log('\n--- 6. 一键提醒未完成学生 ---');
  const remind = await api('/api/alerts/remind-unfinished', tokens.admin, { method: 'POST', body: {} });
  log(`${ok(remind.status)} POST /api/alerts/remind-unfinished ${remind.status}  ` + JSON.stringify(remind.data?.data || remind.data));

  // 7. 学生端「我的提醒」应能看到
  log('\n--- 7. 学生端我的提醒 (stu01) ---');
  const myAlerts = await api('/api/alerts?type=REMIND', tokens.stu01);
  const ma = myAlerts.data?.data || myAlerts.data || [];
  log(`${ok(myAlerts.status)} GET /api/alerts?type=REMIND ${myAlerts.status}  收到提醒数=${Array.isArray(ma) ? ma.length : 'n/a'}`);

  // 8. 学生导出自己的成绩单
  log('\n--- 8. 学生导出成绩单 (stu01) ---');
  const exp = await fetch(`${BASE}/api/completion/export?format=csv`, {
    headers: { Authorization: `Bearer ${tokens.stu01}` },
  });
  log(`${ok(exp.status)} GET /api/completion/export?format=csv ${exp.status}  content-type=${exp.headers.get('content-type')}`);

  // 9. 课代表越权检查（rep 重置老师密码应 403）
  log('\n--- 9. 权限边界(课代表越权) ---');
  const teachList = (await api('/api/users', tokens.admin)).data?.data || [];
  const teacher = teachList.find(u => u.role === 'TEACHER');
  if (teacher) {
    const reset = await api(`/api/users/${teacher.id}/reset-password`, tokens.rep01, {
      method: 'POST', body: { password: '123456' },
    });
    log(`${reset.status === 403 ? '✅' : '❌'} rep 重置 teacher 密码 => ${reset.status} (期望 403)`);
  }

  // 10. 超级管理员独立
  log('\n--- 10. 超级管理员 ---');
  const sa = await api('/api/users', tokens.superadmin);
  log(`${ok(sa.status)} superadmin 访问 /api/users ${sa.status}  (role=${sa.data?.data?.find(u=>u.username==='superadmin')?.role || '-'})`);

  log('\n========== 检验完成 ==========');
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
