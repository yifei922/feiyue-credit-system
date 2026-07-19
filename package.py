import os, zipfile

ROOT = r"C:/Users/40814/WorkBuddy/2026-07-19-17-04-34"
OUT = r"C:/Users/40814/Desktop/feiyue-credit-system-portable.zip"

SKIP_DIRS = {'.git', '.workbuddy', '__pycache__'}

def should_skip(rparts):
    for p in rparts:
        if p in SKIP_DIRS:
            return True
    # 仅保留 server/node_modules，跳过其它 node_modules（如 frontend/node_modules 229M）
    if 'node_modules' in rparts:
        idx = rparts.index('node_modules')
        if idx == 0 or rparts[idx - 1] != 'server':
            return True
    name = rparts[-1]
    if name == 'package.py':
        return True
    if name.endswith('.db') or name.endswith('.log') or name == '.DS_Store':
        return True
    return False

count = 0
size = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        parts = [] if rel_dir == '.' else rel_dir.split(os.sep)
        # 剪枝：跳过不需要遍历的目录
        dirnames[:] = [d for d in dirnames
                       if not (d in SKIP_DIRS or
                               (d == 'node_modules' and (not parts or parts[-1] != 'server')))]
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), ROOT)
            rparts = rel.split(os.sep)
            if should_skip(rparts):
                continue
            z.write(os.path.join(dirpath, fn), rel)
            count += 1
            size += os.path.getsize(os.path.join(dirpath, fn))

print(f"打包完成: {count} 个文件, 约 {size/1024/1024:.1f} MB")
print("输出:", OUT)
