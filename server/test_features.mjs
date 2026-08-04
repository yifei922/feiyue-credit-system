// 端到端验证新功能：登录、超级管理员、全科科目、账号/密码/角色、学分调整、提醒、看板小计
const BASE = 'http://localhost:3013/api';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${extra}`); }
}
async function login(username, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return r.json();
}
async function api(token, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

(async () => {
  console.log('\n=== 1) 超级管理员登录 ===');
  const sa = await login('superadmin', 'Feiyue@2026');
  check('superadmin 登录成功', sa.code === 0 && sa.data?.token, JSON.stringify(sa));
  check('超级管理员角色为 ADMIN', sa.data?.user?.role === 'ADMIN');
  const adminTk = sa.data.token;

  console.log('\n=== 2) 全科科目 ===');
  const subs = await api(adminTk, 'GET', '/subjects');
  const names = (subs.data || []).map(s => s.name);
  check('科目数量 >= 13', names.length >= 13, `实际=${names.length}: ${names.join(',')}`);
  ['语文','数学','英语','物理','化学','生物','道德与法治','历史','地理','体育与健康','音乐','美术','信息科技']
    .forEach(n => check(`含科目「${n}」`, names.includes(n)));

  console.log('\n=== 3) 账号列表 + 修改角色(设为课代表) ===');
  const users = await api(adminTk, 'GET', '/users');
  check('账号列表返回', Array.isArray(users.data) && users.data.length > 0);
  // 取最后一个学生升课代表，避免与步骤4(重置学生1密码)冲突
  const studentUsers = users.data.filter(u => u.role === 'STUDENT');
  const stu = studentUsers[studentUsers.length - 1];
  const physId = (subs.data.find(s => s.name === '物理') || {}).id;
  const roleRes = await api(adminTk, 'POST', `/users/${stu.id}/role`, { role: 'REP', subjectIds: [physId] });
  check('学生升为课代表(物理)成功', roleRes.code === 0, JSON.stringify(roleRes));
  const users2 = await api(adminTk, 'GET', '/users?role=REP');
  const nowRep = users2.data.find(u => u.id === stu.id);
  check('该账号现在角色=REP 且绑定物理', nowRep && nowRep.subjectNames.includes('物理'), JSON.stringify(nowRep));

  console.log('\n=== 4) 重置密码 ===');
  const rp = await api(adminTk, 'POST', `/students/1/reset-password`, { password: 'newpass123' });
  check('按学生重置密码成功', rp.code === 0 && rp.data?.password === 'newpass123', JSON.stringify(rp));
  const stuLogin = await login(rp.data.username, 'newpass123');
  check('学生用新密码登录成功', stuLogin.code === 0 && stuLogin.data?.token, JSON.stringify(stuLogin));

  console.log('\n=== 5) 学分手动增减 ===');
  const before = (await api(adminTk, 'GET', '/students')).data.find(s => s.id === 1);
  const adj = await api(adminTk, 'POST', '/credit-flow/adjust', { studentId: 1, amount: 7, reason: '课堂表现优秀' });
  check('加分成功', adj.code === 0, JSON.stringify(adj));
  check('总学分正确累加(+7)', adj.data?.total === (before.totalCredits + 7), `before=${before.totalCredits} after=${adj.data?.total}`);
  const adj2 = await api(adminTk, 'POST', '/credit-flow/adjust', { studentId: 1, amount: 0 });
  check('0 分被拒绝', adj2.status === 400);

  console.log('\n=== 6) 一键提醒未完成学生 + 学生端可见 ===');
  const remind = await api(adminTk, 'POST', '/alerts/remind-unfinished');
  check('一键提醒返回 count>=0', remind.code === 0 && typeof remind.data?.count === 'number', JSON.stringify(remind));
  // 找一个有未完成任务的学生登录看提醒（stu02 在种子里 UNFINISHED 多）
  const stu2Login = await login('stu02', '123456');
  if (stu2Login.code === 0) {
    const myAlerts = await api(stu2Login.data.token, 'GET', '/alerts');
    const hasRemind = (myAlerts.data || []).some(a => a.type === 'REMIND');
    check('学生端能看到 REMIND 提醒', hasRemind, `alerts=${JSON.stringify((myAlerts.data||[]).map(a=>a.type))}`);
  } else {
    check('stu02 登录(用于验证提醒)', false, JSON.stringify(stu2Login));
  }

  console.log('\n=== 7) 单个学生自定义提醒 ===');
  const notify = await api(adminTk, 'POST', '/alerts/notify', { studentId: 3, message: '请补交数学作业' });
  check('单独提醒成功', notify.code === 0, JSON.stringify(notify));

  console.log('\n=== 8) 数据看板完成情况小计 ===');
  const sum = await api(adminTk, 'GET', '/dashboard/completion-summary');
  check('返回 totalStudents', sum.code === 0 && typeof sum.data?.totalStudents === 'number', JSON.stringify(sum.data?.totalStudents));
  check('返回 byTask 数组', Array.isArray(sum.data?.byTask) && sum.data.byTask.length > 0);
  check('返回 unfinishedList 数组', Array.isArray(sum.data?.unfinishedList));
  check('完成+未完成人数=总人数', sum.data.doneStudents + sum.data.unfinishedStudents === sum.data.totalStudents,
    `${sum.data.doneStudents}+${sum.data.unfinishedStudents} vs ${sum.data.totalStudents}`);

  console.log('\n=== 9) 课代表权限边界 ===');
  // 用刚升的物理课代表登录，尝试重置老师密码应被拒
  const repLogin = await login(nowRep.username, '123456');
  if (repLogin.code === 0) {
    const teacherUser = users.data.find(u => u.role === 'TEACHER');
    const badReset = await api(repLogin.data.token, 'POST', `/users/${teacherUser.id}/reset-password`, {});
    check('课代表不能重置老师密码(403)', badReset.status === 403, JSON.stringify(badReset));
  } else {
    check('物理课代表登录', false, JSON.stringify(repLogin));
  }

  console.log(`\n=== 结果：通过 ${pass}，失败 ${fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
