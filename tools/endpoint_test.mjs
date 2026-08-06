// 生产环境端口/接口/资料链接验证脚本
// 用法：node tools/endpoint_test.mjs  [BASE_URL]
const BASE = process.argv[2] || 'http://localhost:3001';
const log = (...a) => console.log(...a);
const ok = (c) => (c >= 200 && c < 300 ? '✅' : (c === 425 || c === 402 ? '⚠️' : '❌'));

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  return { status: r.status, token: j?.data?.token, role: j?.data?.user?.role, raw: j };
}
async function api(path, token, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET', body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch { data = await r.text(); }
  return { status: r.status, data };
}
async function head(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, ct: r.headers.get('content-type') };
}

(async () => {
  log('==================================================');
  log('  生产环境端口/接口/资料链接验证');
  log('  BASE =', BASE);
  log('==================================================\n');

  // 0. 端口/健康检查
  log('【1】端口 & 健康检查');
  const h = await fetch(`${BASE}/api/health`);
  const hj = await h.json();
  log(`  ${ok(h.status)} GET /api/health  ${h.status}  status=${hj.status}`);

  // 1. 各角色登录
  log('\n【2】各角色账号登录（验证端口鉴权链路）');
  const accounts = [
    ['admin', '123456'], ['teacher01', '123456'], ['rep01', '123456'],
    ['student01', '123456'], ['superadmin', 'Feiyue@2026'],
  ];
  const tokens = {};
  for (const [u, p] of accounts) {
    const { status, token, role } = await login(u, p);
    tokens[u] = token;
    log(`  ${ok(status)} ${u.padEnd(10)} ${status}  role=${role || '-'}`);
  }

  // 2. 资料列表（三个年级）
  log('\n【3】课程资料列表（验证初一/初二/初三已填充）');
  for (const g of ['初一', '初二', '初三']) {
    const r = await api(`/api/mp/resources?grade=${encodeURIComponent(g)}&page=1`, tokens.admin);
    const n = r.data?.data?.list?.length ?? 0;
    log(`  ${ok(r.status)} GET /api/mp/resources?grade=${g}  ${r.status}  返回 ${n} 条`);
  }

  // 3. 资料详情（取一条，验证 requiresAd/canView 元信息）
  log('\n【4】资料详情 & 解锁元信息');
  const listRes = await api('/api/mp/resources?grade=初一', tokens.student01);
  const firstId = listRes.data?.data?.list?.[0]?.id;
  if (firstId) {
    const d = await api(`/api/mp/resources/${firstId}`, tokens.student01);
    const res = d.data?.data?.resource;
    log(`  ${ok(d.status)} GET /api/mp/resources/${firstId}  ${d.status}`);
    log(`     title=${res?.title}  requiresAd=${res?.requiresAd}  canView=${res?.canView}  balance=${res?.pointsBalance}`);
  }

  // 4. 管理端接口
  log('\n【5】管理端接口（ADMIN 权限）');
  const stats = await api('/api/mp/admin/stats', tokens.admin);
  log(`  ${ok(stats.status)} GET /api/mp/admin/stats  ${stats.status}  -> ${JSON.stringify(stats.data?.data || stats.data)?.slice(0,120)}`);
  const adminList = await api('/api/mp/admin/resources', tokens.admin);
  log(`  ${ok(adminList.status)} GET /api/mp/admin/resources  ${adminList.status}  共 ${(adminList.data?.data?.list||[]).length} 条`);

  // 5. 静态资料 HTML 可访问性（核心：复制链接后浏览器能打开）
  log('\n【6】自托管资料 HTML 静态访问（用管理端返回的真实 url）');
  const adminList2 = await api('/api/mp/admin/resources', tokens.admin);
  const sample = (adminList2.data?.data?.list || [])[0];
  if (sample?.url) {
    const s = await head(sample.url);
    log(`  ${ok(s.status)} GET ${sample.url}  ${s.status}  content-type=${s.ct}`);
  } else {
    log('  ⚠️ 未取得样本 url');
  }
  const miss = await head('/study/r0.html');
  log(`  ${ok(miss.status) === '✅' ? '❌' : '✅'} GET /study/r0.html  ${miss.status}  (不存在应 404)`);

  // 6. 微信登录（生产需真实 AppSecret；此处仅验证端点存在）
  log('\n【7】微信登录端点可达性');
  const wx = await fetch(`${BASE}/api/mp/auth/wx-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'test_code' }),
  });
  const wxj = await wx.json().catch(() => ({}));
  log(`  ${wx.status >= 200 && wx.status < 500 ? '✅' : '❌'} POST /api/mp/auth/wx-login  ${wx.status}  (msg=${wxj?.message || '-'})`);

  log('\n==================================================');
  log('  验证完成。✅=正常  ⚠️=业务态(如积分不足/需看广告，属预期)  ❌=异常');
  log('==================================================');
})().catch((e) => { console.error('测试异常:', e); process.exit(1); });
