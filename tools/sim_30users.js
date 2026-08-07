/**
 * 点滴进步 · 小程序端生产环境模拟（契约级回放，v2 修正版）
 * 修正点：
 *   1) 路由匹配支持 :param 通配（/api/tasks/1 ↔ /api/tasks/:id）
 *   2) 区分 必填(req) 与 选填(opt, 后端有默认值)
 *   3) 按路由定义 语义别名(aliases)：小程序 key → 后端 key（如 points→creditValue）
 * 这样避免把「真实存在但带参数的路由」误报为 404；并精确定位字段名错配 bug。
 */
const fs = require('fs');
const path = require('path');

// 后端契约：req=必填(缺失必 400)、opt=选填(后端有默认)、roles=允许角色、aliases=小程序key→后端key
const BACKEND = {
  'POST /api/auth/login': { req: ['username', 'password'] },
  'GET /api/auth/me': {},

  'GET /api/tasks': {},
  'POST /api/tasks': { req: ['title', 'subjectId'], opt: ['creditValue', 'type', 'deadline', 'description'],
    aliases: { points: 'creditValue' }, roles: ['ADMIN', 'TEACHER', 'REP'] },
  'PUT /api/tasks/:id': { req: ['title', 'subjectId'], opt: ['creditValue', 'type', 'deadline', 'description', 'status'],
    aliases: { points: 'creditValue' } },
  'DELETE /api/tasks/:id': {},

  'POST /api/completion/register': { req: ['taskId', 'studentIds', 'status'],
    aliases: { task_id: 'taskId', student_id: 'studentId', student_ids: 'studentIds' }, roles: ['ADMIN', 'TEACHER', 'REP', 'STUDENT'] },
  'POST /api/completion/import': { req: ['csv'], roles: ['ADMIN', 'TEACHER', 'REP'] },

  'GET /api/students': {},
  'POST /api/students': { req: ['name', 'studentNo'], aliases: { student_no: 'studentNo' }, roles: ['ADMIN', 'TEACHER'] },
  'PUT /api/students/:id': { req: ['name', 'studentNo'], aliases: { student_no: 'studentNo' } },
  'DELETE /api/students/:id': {},
  'POST /api/students/:id/reset-password': { roles: ['ADMIN', 'TEACHER', 'REP'] },

  'GET /api/subjects': {},
  'POST /api/subjects': { req: ['name'], opt: ['classId', 'teacherId'], roles: ['ADMIN', 'TEACHER'] },
  'PUT /api/subjects/:id': { req: ['name'], opt: ['teacherId'] },
  'DELETE /api/subjects/:id': {},
  'POST /api/subjects/:id/reps': { req: ['userIds'], roles: ['ADMIN', 'TEACHER'] },

  'GET /api/credit-flow': {},
  'POST /api/credit-flow/adjust': { req: ['studentId', 'amount', 'reason'],
    aliases: { student_id: 'studentId', points: 'amount' }, roles: ['ADMIN', 'TEACHER', 'REP'] },

  'GET /api/users': { reqQ: ['role'], roles: ['ADMIN', 'TEACHER'] },
  'POST /api/users/:id/reset-password': { roles: ['ADMIN', 'TEACHER', 'REP'] },
  'POST /api/users/:id/role': { req: ['role', 'subjectIds'], aliases: { subject_ids: 'subjectIds' }, roles: ['ADMIN', 'TEACHER'] },

  'GET /api/mp/resources': {},
  'GET /api/mp/resources/:id': {},
  'POST /api/mp/resources/:id/ad-done': {},
  'POST /api/mp/resources/:id/access': {},
  'GET /api/mp/admin/resources': { roles: ['ADMIN', 'TEACHER'] },
  'POST /api/mp/admin/resources': { req: ['grade', 'subject', 'title', 'type', 'url'], roles: ['ADMIN', 'TEACHER'] },
  'PUT /api/mp/admin/resources/:id': { req: ['grade', 'subject', 'title', 'type', 'url'] },
  'DELETE /api/mp/admin/resources/:id': {},

  'GET /api/mp/me/points': {},
  'POST /api/mp/points/ad-reward': {},

  'GET /api/alerts': {},
  'POST /api/alerts/scan': { roles: ['ADMIN', 'TEACHER', 'REP'] },
  'PUT /api/alerts/:id/resolve': { roles: ['ADMIN', 'TEACHER', 'REP'] },

  'GET /api/operate-logs': { roles: ['ADMIN', 'TEACHER', 'REP'] },
  'GET /api/dashboard': { roles: ['ADMIN', 'TEACHER', 'REP'] },
};

// 小程序真实请求（与 miniprogram/*.js 源码逐字一致）
const OPS = [
  { mod: '登录鉴权', op: '账号密码登录', method: 'POST', path: '/api/auth/login', roles: ['ADMIN','TEACHER','REP','STUDENT'],
    build: () => ({ body: { username: 'teacher01', password: '123456' } }) },

  { mod: '任务管理', op: '查看任务列表', method: 'GET', path: '/api/tasks', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({ query: {} }) },
  { mod: '任务管理', op: '发布作业(新建任务)', method: 'POST', path: '/api/tasks', roles: ['ADMIN','TEACHER','REP'],
    build: () => ({ body: { title: '第一单元随堂练习', description: '完成练习册P12', subjectId: 1, creditValue: 5, deadline: '2026-08-20', status: 'OPEN' } }) },
  { mod: '任务管理', op: '编辑任务', method: 'PUT', path: '/api/tasks/1', roles: ['ADMIN','TEACHER','REP'],
    build: () => ({ body: { title: '第一单元随堂练习', description: '完成练习册P12', subjectId: 1, creditValue: 10, deadline: '2026-08-22', status: 'OPEN' } }) },
  { mod: '任务管理', op: '删除任务', method: 'DELETE', path: '/api/tasks/1', roles: ['ADMIN','TEACHER','REP'], build: () => ({}) },
  // 小程序 tasks.js onQuickComplete 修复后真实调用
  { mod: '任务管理', op: '快速登记完成/学生提交作业', method: 'POST', path: '/api/completion/register', roles: ['ADMIN','TEACHER','REP','STUDENT'],
    build: () => ({ body: { taskId: 1, studentIds: [1], status: 'FINISHED' } }) },

  { mod: '学生管理', op: '查看学生列表', method: 'GET', path: '/api/students', roles: ['ADMIN','TEACHER','REP'], build: () => ({}) },
  { mod: '学生管理', op: '新增学生', method: 'POST', path: '/api/students', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { name: '王同学', studentNo: '2026021' } }) },
  { mod: '学生管理', op: '编辑学生', method: 'PUT', path: '/api/students/1', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { name: '王同学', studentNo: '2026021' } }) },
  { mod: '学生管理', op: '重置学生密码', method: 'POST', path: '/api/students/1/reset-password', roles: ['ADMIN','TEACHER','REP'], build: () => ({ body: {} }) },
  { mod: '学生管理', op: '删除学生', method: 'DELETE', path: '/api/students/1', roles: ['ADMIN','TEACHER'], build: () => ({}) },

  { mod: '科目管理', op: '查看科目(含课代表)', method: 'GET', path: '/api/subjects', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({}) },
  { mod: '科目管理', op: '新增科目', method: 'POST', path: '/api/subjects', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { name: '物理', teacherId: 2 } }) },
  { mod: '科目管理', op: '设置课代表', method: 'POST', path: '/api/subjects/1/reps', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { userIds: [3] } }) },
  { mod: '科目管理', op: '删除科目', method: 'DELETE', path: '/api/subjects/1', roles: ['ADMIN','TEACHER'], build: () => ({}) },

  { mod: '积分调整', op: '手动加减积分', method: 'POST', path: '/api/credit-flow/adjust', roles: ['ADMIN','TEACHER','REP'],
    build: () => ({ body: { studentId: 1, amount: 5, reason: '课堂表现优秀' } }) },
  { mod: '积分流水', op: '查看积分流水', method: 'GET', path: '/api/credit-flow', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({ query: {} }) },

  { mod: '账号管理', op: '查看账号列表(按角色)', method: 'GET', path: '/api/users', roles: ['ADMIN','TEACHER'],
    build: () => ({ query: { role: 'REP' } }) },
  { mod: '账号管理', op: '重置账号密码', method: 'POST', path: '/api/users/2/reset-password', roles: ['ADMIN','TEACHER','REP'], build: () => ({ body: {} }) },
  { mod: '账号管理', op: '修改用户角色+绑定科目', method: 'POST', path: '/api/users/3/role', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { role: 'REP', subjectIds: [1, 2] } }) },

  { mod: '资料管理', op: '浏览资料列表', method: 'GET', path: '/api/mp/resources', roles: ['ADMIN','TEACHER','REP','STUDENT'],
    build: () => ({ query: { grade: '八年级', subject: '语文', page: 1 } }) },
  { mod: '资料管理', op: '查看资料详情(内联汇编)', method: 'GET', path: '/api/mp/resources/1', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({}) },
  { mod: '资料管理', op: '看完广告回调', method: 'POST', path: '/api/mp/resources/1/ad-done', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({ body: {} }) },
  { mod: '资料管理', op: '实际查阅(扣积分)', method: 'POST', path: '/api/mp/resources/1/access', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({ body: {} }) },
  { mod: '资料管理', op: '后台新增资料', method: 'POST', path: '/api/mp/admin/resources', roles: ['ADMIN','TEACHER'],
    build: () => ({ body: { grade: '八年级', subject: '语文', title: '古诗文重点汇编', type: 'doc', url: 'https://x/1.pdf' } }) },

  { mod: '积分钱包', op: '我的积分余额', method: 'GET', path: '/api/mp/me/points', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({}) },
  { mod: '积分钱包', op: '看广告赚积分', method: 'POST', path: '/api/mp/points/ad-reward', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({ body: {} }) },

  { mod: '预警中心', op: '查看预警列表', method: 'GET', path: '/api/alerts', roles: ['ADMIN','TEACHER','REP','STUDENT'], build: () => ({}) },
  { mod: '预警中心', op: '手动扫描预警', method: 'POST', path: '/api/alerts/scan', roles: ['ADMIN','TEACHER','REP'], build: () => ({ body: {} }) },
  { mod: '预警中心', op: '标记预警解决', method: 'PUT', path: '/api/alerts/1/resolve', roles: ['ADMIN','TEACHER','REP'], build: () => ({}) },

  { mod: '操作日志', op: '查看操作日志', method: 'GET', path: '/api/operate-logs', roles: ['ADMIN','TEACHER','REP'], build: () => ({}) },
  { mod: '数据看板', op: '查看数据看板', method: 'GET', path: '/api/dashboard', roles: ['ADMIN','TEACHER','REP'], build: () => ({}) },
];

function buildRoster() {
  const r = [];
  r.push({ role: 'ADMIN', name: '管理员A' }, { role: 'ADMIN', name: '管理员B' });
  ['杨老师','李老师','陈老师','赵老师'].forEach(n => r.push({ role: 'TEACHER', name: n }));
  ['李课代(语文)','张课代(数学)','王课代(英语)','刘课代(物理)','陈课代(化学)','杨课代(生物)','黄课代(历史)','周课代(地理)'].forEach(n => r.push({ role: 'REP', name: n }));
  for (let i = 1; i <= 16; i++) r.push({ role: 'STUDENT', name: `学生${String(i).padStart(2,'0')}` });
  return r;
}

function segMatch(patSeg, reqSeg) { return patSeg.startsWith(':') || patSeg === reqSeg; }
function matchRoute(method, p) {
  const reqParts = p.split('/');
  for (const key of Object.keys(BACKEND)) {
    const [m, ...pp] = key.split(' ');
    if (m !== method) continue;
    const patParts = pp.join(' ').split('/');
    if (patParts.length !== reqParts.length) continue;
    if (patParts.every((s, i) => segMatch(s, reqParts[i]))) return BACKEND[key];
  }
  return null;
}

function evalOp(op, user) {
  const reqBody = op.build().body || {};
  const reqQuery = op.build().query || {};
  const backend = matchRoute(op.method, op.path);
  const routeKey = `${op.method} ${op.path}`;

  if (!backend) {
    const hint = (op.path === '/api/completion') ? '正确路径应为 POST /api/completion/register（且字段应为 taskId/studentIds）' : '';
    return { verdict: 'FAIL', kind: 'ROUTE_NOT_FOUND', detail: `后端无此路由：${routeKey}。${hint} 生产环境将返回 404「接口不存在」` };
  }
  if (backend.roles && !backend.roles.includes(user.role)) {
    return { verdict: 'FAIL', kind: 'PERMISSION', detail: `角色 ${user.role} 无权访问，后端将返回 403` };
  }
  const aliases = backend.aliases || {};
  const renameOf = (f) => Object.keys(reqBody).find(k => aliases[k] === f) ||
    Object.keys(reqBody).find(k => toCamel(k) === f || toSnake(k) === f) || null;

  // 必填
  const missReq = [], renameReq = [];
  for (const f of (backend.req || [])) {
    if (!(f in reqBody)) {
      const rk = renameOf(f);
      if (rk) renameReq.push(`后端要「${f}」，小程序发的是「${rk}」`);
      else missReq.push(f);
    }
  }
  for (const f of (backend.reqQ || [])) { if (!(f in reqQuery)) missReq.push(`query.${f}`); }
  if (renameReq.length) return { verdict: 'FAIL', kind: 'FIELD_RENAME', detail: renameReq.join('；') + ' → 字段被忽略/读为 undefined，接口大概率 400 或存空值' };
  if (missReq.length) return { verdict: 'FAIL', kind: 'FIELD_MISSING', detail: `缺少后端必需字段：${missReq.join(', ')}` };

  // 选填（有默认）；若小程序发了别名 key → 数据丢失型 rename
  const optRename = [];
  for (const f of (backend.opt || [])) {
    if (!(f in reqBody)) {
      const rk = renameOf(f);
      if (rk) optRename.push(`后端选填「${f}」被小程序以「${rk}」发送 → 后端取默认值(数据未写入)`);
    }
  }
  if (optRename.length) return { verdict: 'FAIL', kind: 'FIELD_RENAME_OPT', detail: optRename.join('；') };

  return { verdict: 'PASS', kind: 'OK', detail: '小程序请求体与后端契约一致，生产环境可正常执行' };
}
function toCamel(s){return s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());}
function toSnake(s){return s.replace(/[A-Z]/g,m=>'_'+m.toLowerCase());}

const roster = buildRoster();
const results = [];
const moduleStats = {};
let total = 0, pass = 0, fail = 0;
const failOps = {};
for (const user of roster) {
  for (const op of OPS) {
    if (!op.roles.includes(user.role)) continue;
    const r = evalOp(op, user);
    const opKey = `${op.mod} / ${op.op}`;
    moduleStats[op.mod] = moduleStats[op.mod] || { total: 0, pass: 0, fail: 0 };
    moduleStats[op.mod].total++; total++;
    if (r.verdict === 'PASS') { pass++; moduleStats[op.mod].pass++; }
    else {
      fail++; moduleStats[op.mod].fail++;
      if (!failOps[opKey]) failOps[opKey] = { mod: op.mod, op: op.op, method: op.method, path: op.path,
        mpBody: op.build().body || {}, kind: r.kind, detail: r.detail, count: 0 };
      failOps[opKey].count++;
    }
    results.push({ user: user.name, role: user.role, mod: op.mod, op: op.op, method: op.method, path: op.path,
      mpBody: op.build().body || {}, verdict: r.verdict, kind: r.kind, detail: r.detail });
  }
}

const summary = { generatedAt: new Date().toISOString(), rosterSize: roster.length,
  rosterBreakdown: { ADMIN: 2, TEACHER: 4, REP: 8, STUDENT: 16 },
  totalOps: total, pass, fail, passRate: (pass / total * 100).toFixed(1) + '%' };
const out = { summary, moduleStats, failOps: Object.values(failOps), results };
fs.writeFileSync(path.join(__dirname, 'sim_result.json'), JSON.stringify(out, null, 2), 'utf8');

console.log('=== 模拟完成（v2 修正版）===');
console.log(`花名册: ${summary.rosterSize} 人 | 操作总数: ${total} | 通过: ${pass} | 失败: ${fail} | 通过率: ${summary.passRate}`);
console.log('\n模块维度:');
for (const [m, s] of Object.entries(moduleStats)) console.log(`  ${m.padEnd(8)} 总${s.total} 通过${s.pass} 失败${s.fail}`);
console.log('\n失败操作归类(去重):');
for (const f of Object.values(failOps)) {
  console.log(`  [${f.kind}] ${f.mod}/${f.op}  ${f.method} ${f.path}  x${f.count}`);
  console.log(`        → ${f.detail}`);
}
console.log('\n已写入 tools/sim_result.json');
