// tools/verify_function_calls.js
// 静态扫描 server/src/*.js：检查所有 require('./xxx').func(...) 的 func 都在目标文件里实际导出。
// 防止「调用了未导出的函数」类 bug 在生产环境崩溃时才发现（云托管 readiness 探针失败 = 整个版本不可用）。
//
// 用法：
//   node tools/verify_function_calls.js
// 退出码：0 通过；1 发现不匹配

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'server', 'src');

// 提取 ESM/CJS 导出名：识别 `module.exports = { a, b: c }`、`exports.x = ...`、`export const x = ...`、`export function x(...)` 等
function extractExports(src) {
  const exports = new Set();
  // module.exports = { a, b: c, d: e }; 形式
  const re1 = /module\.exports\s*=\s*\{([^}]+)\}/g;
  let m;
  while ((m = re1.exec(src))) {
    m[1].split(',').forEach((part) => {
      const seg = part.trim().split(/\s*[:=]\s*/);
      if (seg[0]) exports.add(seg[0].trim());
    });
  }
  // exports.foo = ... / exports.foo = function ...
  const re2 = /exports\.(\w+)\s*=/g;
  while ((m = re2.exec(src))) exports.add(m[1]);
  return exports;
}

// 提取 require('./xxx').func 或 require('./xxx').foo(args) 调用点
function extractRequireCalls(src) {
  const calls = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)\s*\.(\w+)/g;
  let m;
  while ((m = re.exec(src))) {
    calls.push({ module: m[1], func: m[2] });
  }
  return calls;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(SRC_DIR);
const exportMap = new Map(); // relativeRequire → Set<funcName>
for (const f of files) {
  const src = fs.readFileSync(f, 'utf-8');
  const exp = extractExports(src);
  exportMap.set(path.basename(f), exp);
  exportMap.set(path.relative(SRC_DIR, f).replace(/\\/g, '/'), exp);
}

const errors = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf-8');
  const calls = extractRequireCalls(src);
  for (const c of calls) {
    // 仅检查相对路径（./xxx 或 ../xxx）
    if (!c.module.startsWith('.')) continue;
    const target = c.module.replace(/^\.\//, '');
    const exp = exportMap.get(target) || exportMap.get(target + '.js');
    if (!exp) {
      // 找不到目标文件，跳过（可能是合理：被 git ignore / 已删除但仍被 require）
      continue;
    }
    if (!exp.has(c.func)) {
      errors.push({
        file: path.relative(SRC_DIR, f),
        require: c.module,
        missing: c.func,
        available: [...exp].sort().join(', '),
      });
    }
  }
}

if (errors.length === 0) {
  console.log(`✓ verify_function_calls: 扫描 ${files.length} 个文件，所有 require 调用均指向实际导出`);
  process.exit(0);
} else {
  console.error(`✗ verify_function_calls: 发现 ${errors.length} 处调用未导出的函数：\n`);
  for (const e of errors) {
    console.error(`  ${e.file}`);
    console.error(`    require('${e.require}').${e.missing} ❌`);
    console.error(`    实际导出: { ${e.available} }\n`);
  }
  process.exit(1);
}