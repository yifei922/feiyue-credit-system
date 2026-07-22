#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
斐越十班学分系统 —— 完整迁移包（用户要求：全部数据 + 对话记录，不遗漏任何东西）
包含：
  1) project/        —— 整个项目目录（含 .git 全历史 / node_modules / runtime / server/data/* 所有数据库 / .workbuddy/memory）
  2) workbuddy-user/ —— 用户级 WorkBuddy 数据（对话记录 workbuddy.db、本项目 jsonl、tasks、sessions、memory、blobs、clipboard-images 等）
                        剔除程序二进制 binaries/vendor/plugins/skills-marketplace/logs/traces 等，避免覆盖新电脑程序
"""
import os
import zipfile

PROJECT = "C:/Users/40814/WorkBuddy/2026-07-19-17-04-34"
USER = "C:/Users/40814/.workbuddy"
STAGING_DB = "C:/Users/40814/_wb_migrate_tmp/workbuddy.db"
OUT = "C:/Users/40814/Desktop/feiyue-credit-FULL-migration.zip"

# 用户级 .workbuddy 下这些"程序/缓存"目录不打包（会随 WorkBuddy 安装自带，且覆盖有风险）
USER_SKIP_TOP = {"binaries", "vendor", "skills-marketplace", "plugins",
                 "logs", "traces", "shell-snapshots", "audit-log", "app"}

README = """斐越十班学分系统 —— 完整迁移包（含全部数据 + 对话记录）
生成时间：2026-07-20

本压缩包包含两份内容：
1) project/        整个学分系统项目：源代码、所有数据库(server/data/*)、.git 完整历史、node_modules、node 运行时(runtime)、项目记忆(.workbuddy/memory)。
2) workbuddy-user/ 你这台电脑 WorkBuddy 的“用户数据”：对话记录主库(workbuddy.db)、本项目对话原文(projects/*.jsonl)、任务(tasks)、会话(sessions/workspace)、记忆(MEMORY.md/USER.md/SOUL.md)、图片(blobs/clipboard-images)、产物索引(artifact-index) 等。
   （已剔除 WorkBuddy 自身的程序文件 binaries/vendor/plugins/skills-marketplace 等，避免覆盖新电脑的程序。）

===== 在新电脑上还原步骤 =====

【第 1 步】新电脑先安装并打开 WorkBuddy，用“同一个账号”登录一次
   （这样云端对话也会同步；本包作为本地完整备份，即使离线也能还原。）

【第 2 步】合并用户数据（让对话记录出现）
   a. 关闭 WorkBuddy。
   b. 把本包解压。
   c. 备份新电脑的 C:\\Users\\你的用户名\\.workbuddy\\ 文件夹（改成别的名字，防止意外）。
   d. 把 workbuddy-user\\ 里面的所有内容，复制合并到新电脑的 C:\\Users\\你的用户名\\.workbuddy\\ 里（同名文件覆盖）。
      重点确保这些到位：workbuddy.db、projects\\、workspace\\sessions\\、tasks\\、sessions\\、memory\\、MEMORY.md、USER.md、SOUL.md、blobs\\、clipboard-images\\、artifact-index\\。
   e. 重新打开 WorkBuddy，左侧历史/对话里就能看到本次全部会话。

【第 3 步】打开项目
   a. 把 project\\ 解压到任意文件夹（例如 D:\\feiyue-credit）。
   b. 在 WorkBuddy 中“打开文件夹”选中它作为项目。
   c. 项目记忆(.workbuddy/memory)会自动加载。
   d. 本地运行：双击 project\\ 里的 start.bat（需先装 Node 22），或访问已上线的 https://feiyue-credit.onrender.com

===== 默认账号 =====
admin / 123456
teacher01 / 123456
rep01、rep02 / 123456
stu01~stu06 / 123456
superadmin / Feiyue@2026   （请上线后尽快改密码）

===== 说明 =====
- 本包未做任何“安全/体积”删减，全部任务产物与数据均已包含。
- 若新电脑已用同一账号，对话也可能已自动云端同步；本包保证即使离线也能完整还原。
"""

count = 0
total = 0


def walk_add(zf, base_dir, arc_prefix, skip_top=None, skip_files=None):
    global count, total
    for dirpath, dirnames, filenames in os.walk(base_dir):
        rel_dir = os.path.relpath(dirpath, base_dir)
        if rel_dir == ".":
            rel_dir = ""
        pruned = []
        for d in dirnames:
            rd = ((rel_dir + "/" + d) if rel_dir else d)
            if skip_top and rd.split("/")[0] in skip_top:
                continue
            pruned.append(d)
        dirnames[:] = pruned
        for fn in filenames:
            if skip_files and fn in skip_files:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, base_dir)
            arc = (arc_prefix + "/" + rel).replace("\\", "/")
            try:
                zf.write(full, arc)
                count += 1
                total += os.path.getsize(full)
            except (OSError, PermissionError) as e:
                print(f"  skip: {arc}  {e}")


def main():
    global count, total
    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.writestr("feiyue-credit-FULL-migration/README.txt", README)
        print(">> 打包 project/ (项目全量，含 .git/node_modules/runtime/所有数据库) ...")
        walk_add(zf, PROJECT, "feiyue-credit-FULL-migration/project")
        print(">> 打包 workbuddy-user/ (用户数据：对话记录/记忆/图片) ...")
        # 用户级 .workbuddy 下跳过 workbuddy.db*（用一致性复制的版本单独加）
        walk_add(zf, USER, "feiyue-credit-FULL-migration/workbuddy-user",
                 skip_top=USER_SKIP_TOP,
                 skip_files={"workbuddy.db", "workbuddy.db-shm", "workbuddy.db-wal"})
        if os.path.exists(STAGING_DB):
            zf.write(STAGING_DB, "feiyue-credit-FULL-migration/workbuddy-user/workbuddy.db")
            count += 1
            total += os.path.getsize(STAGING_DB)
            print("   已加入一致性复制的 workbuddy.db (对话记录)")
    size_mb = os.path.getsize(OUT) / 1024 / 1024
    print("packed OK")
    print(f"  files: {count}")
    print(f"  raw:   {total/1024/1024:.1f} MB")
    print(f"  zip:   {OUT}")
    print(f"  size:  {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
