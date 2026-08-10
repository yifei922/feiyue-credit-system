import re
admin_files = [
    ('miniprogram/pages/admin/index.js',         ['ADMIN','TEACHER','REP']),
    ('miniprogram/pages/admin/users.js',        ['ADMIN','TEACHER']),
    ('miniprogram/pages/admin/tasks.js',        ['ADMIN','TEACHER','REP']),
    ('miniprogram/pages/admin/students.js',     ['ADMIN','TEACHER','REP']),
    ('miniprogram/pages/admin/subjects.js',     ['ADMIN','TEACHER']),
    ('miniprogram/pages/admin/resources.js',    ['ADMIN','TEACHER']),
    ('miniprogram/pages/admin/operate-log.js',  ['ADMIN','TEACHER','REP']),
    ('miniprogram/pages/admin/alerts.js',       ['ADMIN','TEACHER','REP']),
    ('miniprogram/pages/admin/credits-adjust.js', ['ADMIN','TEACHER','REP']),
]

for fp, roles in admin_files:
    with open(fp, 'r', encoding='utf-8') as f:
        src = f.read()
    if "requireRole(" in src and "auth-guard" in src:
        print('[SKIP]', fp, 'already guarded')
        continue
    # 插入 require
    insert = "\nconst { requireRole } = require('../../utils/auth-guard.js');\n"
    lines = src.split('\n')
    last_require_idx = -1
    for i, line in enumerate(lines):
        if re.search(r"require\(", line):
            last_require_idx = i
    if last_require_idx == -1:
        for i, line in enumerate(lines):
            if 'getApp()' in line:
                last_require_idx = i
                break
    if last_require_idx == -1:
        print('[WARN]', fp, 'no insertion point')
        continue
    lines.insert(last_require_idx + 1, insert.rstrip())
    new_src = '\n'.join(lines)

    # 在 onLoad 体内插入 requireRole
    role_args = ', '.join("'" + r + "'" for r in roles)
    new_src = re.sub(
        r"(onLoad\(.*?\)\s*\{)",
        lambda m: m.group(1) + "\n    if (!requireRole([" + role_args + "])) return;",
        new_src, count=1
    )
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(new_src)
    print('[OK]', fp)

import subprocess
NODE = r'C:/Users/20242/.workbuddy/binaries/node/versions/22.12.0/node.exe'
for fp, _ in admin_files:
    r = subprocess.run([NODE, '--check', fp], capture_output=True, text=True)
    status = 'OK' if r.returncode == 0 else 'FAIL: ' + r.stderr[:120]
    print('  syntax', fp, ':', status)
