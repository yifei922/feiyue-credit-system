// 审计所有 server/src 文件中 .run/.get/.all() 缺 await 的情况
const fs = require('fs');
const files = [
  'server/src/db.js',
  'server/src/seed_resources.js',
  'server/src/routes/completions.js',
  'server/src/routes/creditFlow.js',
  'server/src/routes/students.js',
  'server/src/routes/subjects.js',
  'server/src/routes/users.js',
  'server/src/routes/tasks.js',
  'server/src/routes/dashboard.js',
  'server/src/routes/alerts.js',
  'server/src/routes/mp_auth.js',
  'server/src/routes/mp_feed.js',
  'server/src/routes/mp_points.js',
  'server/src/routes/mp_profile.js',
  'server/src/routes/mp_resources.js',
  'server/src/routes/mp_admin.js',
  'server/src/routes/operateLog.js',
  'server/src/routes/uploads.js',
  'server/src/routes/recommend.js',
  'server/src/routes/auth.js',
];

const results = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const issues = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed.match(/\.(run|get|all)\(/)) return;
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (trimmed.match(/^(const|let|var)\s+\w+\s*=\s*db\.prepare/)) return;
    if (line.includes('await ')) return;
    // 排除 callback 内部（行内带 function/=> 且后面是 callback 参数）
    // 这里不深究，标出来人工确认
    issues.push({ line: idx + 1, text: trimmed.slice(0, 100) });
  });
  if (issues.length) {
    results.push({ file: f, count: issues.length, issues });
  }
}
for (const r of results) {
  console.log('\n=== ' + r.file + ' (' + r.count + ' 处可疑) ===');
  for (const i of r.issues) {
    console.log('  L' + i.line + ': ' + i.text);
  }
}
console.log('\n总计: ' + results.length + ' 个文件有可疑 await 缺失');
