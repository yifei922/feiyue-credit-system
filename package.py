#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
斐越十班学分系统 —— 完整可移植打包脚本
生成一个可直接在新电脑运行的 zip（内置 node.exe，零安装）。
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_ZIP = os.path.join(os.path.expanduser("~"), "Desktop", "feiyue-credit-system-full.zip")


def should_skip(rel_path):
    p = rel_path.replace("\\", "/")
    parts = p.split("/")
    # .git 整个目录（内含 GitHub token，禁止打包）
    if parts[0] == ".git":
        return True
    # frontend/node_modules（体积巨大，新电脑 npm install 还原）
    if p.startswith("frontend/node_modules/"):
        return True
    # 临时测试数据库（新电脑首次启动会自动建库）
    if p.startswith("server/data/"):
        return True
    # .workbuddy 下只保留 memory（项目任务笔记），其余不带
    if parts[0] == ".workbuddy" and not p.startswith(".workbuddy/memory"):
        return True
    base = parts[-1]
    if base.endswith(".log"):
        return True
    if base == "test_features.mjs":
        return True
    if base.endswith(".zip"):
        return True
    if base in ("Thumbs.db", ".DS_Store"):
        return True
    return False


def main():
    if os.path.exists(OUT_ZIP):
        os.remove(OUT_ZIP)

    count = 0
    total_bytes = 0
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            rel_dir = os.path.relpath(dirpath, ROOT)
            if rel_dir == ".":
                rel_dir = ""
            pruned = []
            for d in dirnames:
                rd = ((rel_dir + "/" + d) if rel_dir else d).replace("\\", "/")
                if rd in (".git", "frontend/node_modules", "server/data"):
                    continue
                pruned.append(d)
            dirnames[:] = pruned

            for fn in filenames:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                if should_skip(rel):
                    continue
                arcname = os.path.join("feiyue-credit-system", rel)
                try:
                    zf.write(full, arcname)
                    count += 1
                    total_bytes += os.path.getsize(full)
                except (OSError, PermissionError) as e:
                    print(f"  skip(locked): {rel}  {e}")

    size_mb = os.path.getsize(OUT_ZIP) / 1024 / 1024
    raw_mb = total_bytes / 1024 / 1024
    print("packed OK")
    print(f"  files: {count}")
    print(f"  raw:   {raw_mb:.1f} MB")
    print(f"  zip:   {OUT_ZIP}")
    print(f"  size:  {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
