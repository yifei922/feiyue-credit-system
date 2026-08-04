#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
斐越十班学分系统 —— 完整可移植打包（含真实任务数据）
生成可直接在新电脑运行/部署的 zip。
为控制体积以便通过邮件发送，本包不含 87MB 的 node.exe 运行时与 node_modules，
新电脑运行只需安装 Node 22（或使用已上线的 Render 在线版）。
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_ZIP = os.path.join(os.path.expanduser("~"), "Desktop", "feiyue-credit-system-带数据.zip")

# 仅保留的真实数据库（其余为测试/临时库，不打包）
KEEP_DBS = {"credit.db"}


def should_skip(rel_path):
    p = rel_path.replace("\\", "/")
    parts = p.split("/")
    base = parts[-1]
    # .git 整个目录（内含 GitHub token，禁止打包）
    if parts[0] == ".git":
        return True
    # node_modules 任意层级（体积大，新电脑 npm install 还原）
    if "node_modules" in parts:
        return True
    # runtime 整体（含 node.exe 87MB，邮件发不了）
    if parts[0] == "runtime":
        return True
    # .workbuddy 仅保留 memory（项目任务笔记）
    if parts[0] == ".workbuddy" and (len(parts) < 2 or parts[1] != "memory"):
        return True
    # server/data：仅保留 credit.db（真实任务数据），其余测试库不打包
    if len(parts) >= 3 and parts[0] == "server" and parts[1] == "data" and base not in KEEP_DBS:
        return True
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
            # 目录级剪枝：控制是否继续向下遍历
            pruned = []
            for d in dirnames:
                rd = ((rel_dir + "/" + d) if rel_dir else d).replace("\\", "/")
                if d in (".git", "node_modules", "runtime"):
                    continue
                # .workbuddy 下只保留 memory 子目录
                if rel_dir == ".workbuddy" and d != "memory":
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
