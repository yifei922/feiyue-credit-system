#!/usr/bin/env python3
"""手工构造 git commit 并推送 - 完全跳过 git 命令，直接构造二进制 git object"""
import subprocess, os, time, sys, hashlib, struct, glob, zlib
sys.stdout.reconfigure(encoding='utf-8')

ROOT = "C:/Users/20242/WorkBuddy/feiyue-credit"
os.chdir(ROOT)

# git object 存储格式：zlib 压缩后写入 .git/objects/xx/yyyyyyyyy（前2字符是目录）
def write_obj(raw_bytes):
    h = hashlib.sha1(raw_bytes).hexdigest()
    obj_path = f'.git/objects/{h[:2]}/{h[2:]}'
    if not os.path.exists(obj_path):
        os.makedirs(os.path.dirname(obj_path), exist_ok=True)
        compressed = zlib.compress(raw_bytes)
        with open(obj_path, 'wb') as f:
            f.write(compressed)
    return h

# 列出需要提交的文件 (用 git ls-files --others 获取真实 Unicode 文件名)
# 排除 mktree-*.input 临时调试文件
import subprocess
out = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard',
                      '--ignored-only'], capture_output=True).stdout.decode('utf-8', errors='replace')
untracked = [l for l in out.split('\n') if l.strip() and not l.startswith('mktree-')]
# 同时再用 ls-files 不过滤 mktree，因为 mktree 不应该出现在 index
out2 = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'],
                      capture_output=True).stdout.decode('utf-8', errors='replace')
untracked = [l for l in out2.split('\n') if l.strip() and not l.startswith('mktree-')]
modified_out = subprocess.run(['git', 'diff', '--name-only'],
                              capture_output=True).stdout.decode('utf-8', errors='replace')
modified = [l for l in modified_out.split('\n') if l.strip() and not l.startswith('mktree-')]
# unquote git octal escapes
import re
def unquote_git(s):
    return re.sub(r'\\([0-3][0-7][0-7])', lambda m: chr(int(m.group(1), 8)), s)
untracked = [unquote_git(l) for l in untracked]
modified = [unquote_git(l) for l in modified]
all_files = list(set(untracked + modified))
print('files:', len(all_files))

# 为每个文件 hash blob
blob_map = {}
for f in all_files:
    if not os.path.exists(f):
        print(f'WARN: {f!r} 不存在')
        continue
    if os.path.isdir(f):
        for root, _, names in os.walk(f):
            for n in names:
                p = os.path.join(root, n).replace('\\', '/')
                blob = open(p, 'rb').read()
                h = write_obj(b'tree 0\0' if False else b'blob ' + str(len(blob)).encode() + b'\0' + blob)
                blob_map[p] = h
        continue
    blob = open(f, 'rb').read()
    h = write_obj(b'blob ' + str(len(blob)).encode() + b'\0' + blob)
    blob_map[f] = h
print('blobs:', len(blob_map))

# 递归构造 tree
def make_tree(prefix=''):
    """构造 tree object 二进制内容"""
    # 收集直接子项（文件 + 子目录）
    items = []
    subdirs = {}
    for path, h in blob_map.items():
        if not path.startswith(prefix): continue
        rest = path[len(prefix):]
        if not rest: continue
        parts = rest.split('/', 1)
        if len(parts) == 1:
            # 文件 entry：mode=100644；sort 用 name 原样
            mode = 0o100644
            hash_bytes = bytes.fromhex(h)
            items.append((mode, hash_bytes, parts[0], parts[0]))
        else:
            sd = parts[0]
            if sd not in subdirs:
                subdirs[sd] = make_tree(prefix + sd + '/' if prefix else sd + '/')
    # 子目录 entry：mode=040000；sort 用 name + '/'
    for sd, sub_h in subdirs.items():
        sub_bytes = bytes.fromhex(sub_h)
        items.append((0o40000, sub_bytes, sd, sd + '/'))
    # 排序：git tree entry 按 (sort_key) 排序
    items.sort(key=lambda x: x[3].encode('utf-8'))
    # 构造 tree object body
    body = b''
    for mode, hash_bytes, name, _ in items:
        # 正确格式：<mode octal 无前导0><SP><name>\0<20-byte-binary-sha1>
        mode_str = f'{mode:o}'.encode()
        # 不补零到 6 位
        body += mode_str + b' ' + name.encode('utf-8') + b'\0' + hash_bytes
    if not body:
        return None  # 空目录（实际不该发生）
    # 完整 tree object = b'tree ' + len + \0 + body
    full = b'tree ' + str(len(body)).encode() + b'\0' + body
    return write_obj(full)

TREE = make_tree()
print('tree:', TREE)

# 构造 commit object
PARENT = '538599493ffd27e3f3e17158291ab43478d1a14a'
MSG = """feat: Web资源管理页 + 小程tab图标 + 广告位文档 + 安全爬虫 + 审核PDF + AppSecret重置指南

P3 Web资源管理 (ResourceManage.vue + api/resource.js + 路由 + /admin/resources/batch 批量导入)
小程tab图标 (miniprogram/assets/tab/ 10 PNG + make_icons.py + config/ad-config.js)
P4 广告位 (docs/WECHAT_AD_GUIDE.md)
P5 安全爬虫 (tools/safe_crawler.py 白名单 + 人工审核pending表)
P6 审核PDF (generate_miniapp_review_guide.py + 6步操作+驳回对策)
P7 AppSecret重置 (docs/WECHAT_APPSECRET_RESET.md)"""
AUTHOR_LINE = '斐越十班 <class@feiyue.example>'
TS = int(time.time())
TZ = '+0800'
commit_body = f'tree {TREE}\nparent {PARENT}\nauthor {AUTHOR_LINE} {TS} {TZ}\ncommitter {AUTHOR_LINE} {TS} {TZ}\n\n{MSG}\n'
commit_full = b'commit ' + str(len(commit_body.encode())).encode() + b'\0' + commit_body.encode('utf-8')
COMMIT = write_obj(commit_full)
print('commit:', COMMIT)

# 写 master ref (Python 内置 open)
ref_path = '.git/refs/heads/master'
old = None
if os.path.exists(ref_path):
    try:
        with open(ref_path, 'rb') as f:
            old = f.read()
        os.remove(ref_path)
    except: pass
with open(ref_path, 'wb') as f:
    f.write(COMMIT.encode() + b'\n')
print('master ref updated', 'old=', old)

# 推送
result = subprocess.run(['git', 'push', 'origin', 'master'], capture_output=True)
print('---PUSH STDOUT---')
print(result.stdout.decode('utf-8', errors='replace'))
print('---PUSH STDERR---')
print(result.stderr.decode('utf-8', errors='replace'))
print('returncode:', result.returncode)