#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包 server/ 为微信云托管可上传的代码包。

云托管要求：zip 内根目录必须直接包含 package.json（即 server/ 的内容，
而非 server/ 这一层目录）。本脚本按此规则打包，并排除 node_modules / .git / .env。

用法：
    python tools/package_server.py
产物：
    dist/server-cloudrun.zip
"""
import os
import sys
import zipfile
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DIR = os.path.join(ROOT, "server")
OUT_DIR = os.path.join(ROOT, "dist")
OUT_ZIP = os.path.join(OUT_DIR, "server-cloudrun.zip")

EXCLUDE_DIRS = {".git", "node_modules", "dist", "__pycache__", ".workbuddy"}
EXCLUDE_FILES = {".env", ".DS_Store", "npm-debug.log"}


def main():
    if not os.path.isdir(SERVER_DIR):
        print(f"[ERR] 找不到 server 目录: {SERVER_DIR}")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    if os.path.exists(OUT_ZIP):
        os.remove(OUT_ZIP)

    count = 0
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, dirs, files in os.walk(SERVER_DIR):
            # 就地剪枝，避免递归进排除目录
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                if f in EXCLUDE_FILES:
                    continue
                full = os.path.join(base, f)
                # 归档路径：去掉 SERVER_DIR 前缀，使 package.json 位于 zip 根
                arc = os.path.relpath(full, SERVER_DIR)
                zf.write(full, arc)
                count += 1

    size = os.path.getsize(OUT_ZIP)
    print(f"[OK] 已打包 {count} 个文件 -> {OUT_ZIP}")
    print(f"[OK] 大小 {size/1024:.1f} KB")
    print("[TIP] 在云托管控制台「版本管理 → 新建版本 → 代码包上传」选此 zip 即可。")
    # 校验根目录含 package.json
    with zipfile.ZipFile(OUT_ZIP) as zf:
        names = zf.namelist()
        if "package.json" not in names:
            print("[WARN] zip 根目录缺少 package.json，云托管将无法识别项目！")
            sys.exit(2)
        print("[OK] package.json 位于 zip 根目录，校验通过。")


if __name__ == "__main__":
    main()
