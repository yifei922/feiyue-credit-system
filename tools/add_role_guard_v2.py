import re

# 第二个版本：把守卫放到 onLoad 开头；若没有 onLoad 则放到 onShow 开头
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
    # 如果已经加过 onShow 守卫，跳过
    if "onShow() {" in src and "requireRole(" in src.split("onShow() {")[1].split("}")[0]:
        continue
    role_args = ', '.join("'" + r + "'" for r in roles)
    # 优先 onLoad，没有则 onShow
    if re.search(r"onLoad\(", src):
        # 检查是否已有守卫
        if "if (!requireRole(" in src:
            continue
        new_src = re.sub(
            r"(onLoad\([^)]*\)\s*\{)",
            lambda m: m.group(1) + "\n    if (!requireRole([" + role_args + "])) return;",
            src, count=1
        )
    elif re.search(r"onShow\(\)\s*\{", src):
        new_src = re.sub(
            r"(onShow\(\)\s*\{)",
            lambda m: m.group(1) + "\n    if (!this._roleChecked && !requireRole([" + role_args + "])) return; this._roleChecked = true;",
            src, count=1
        )
    else:
        print('[WARN]', fp, 'no onLoad/onShow')
        continue
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(new_src)
    print('[OK]', fp)

# 语法校验
import subprocess
NODE = r'C:/Users/20242/.workbuddy/binaries/node/versions/22.12.0/node.exe'
for fp, _ in admin_files:
    r = subprocess.run([NODE, '--check', fp], capture_output=True, text=True)
    print('  syntax', fp, ':', 'OK' if r.returncode == 0 else 'FAIL: ' + r.stderr[:120])
