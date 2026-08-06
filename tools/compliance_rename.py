# -*- coding: utf-8 -*-
"""
小程序个人主体合规化改造
目的：去除涉校名/公司名/教育前置审批词，使小程序内容符合微信「个人主体」备案要求。
原则：只替换用户可见的中文显示文案，绝不改动任何功能代码（角色 key、字段名、路由等）。
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP = os.path.join(ROOT, 'miniprogram')

# 替换映射：按长度倒序执行，避免短词先替换破坏长词
REPLACEMENTS = [
    # ===== 🔴 最高危：具体校名（个人主体绝对禁止）=====
    ('洛一高附中八（十）班学分管理系统 - 微信小程序端', '点滴进步 - 个人学习记录工具'),
    ('洛一高附中八（十）班 · 学分与资料管理', '管理中心'),
    ('洛一高附中八（十）班', '点滴进步'),

    # ===== 🔴 公司主体暗示（个人主体不得以公司名义）=====
    ('斐越科技 出品 · 班级学分管理小程序 v1.1', '点滴进步 v1.1 · 个人开发者作品'),
    ('斐越科技 出品', '个人开发者作品'),

    # ===== 🔴 教育前置审批词：学分 → 积分 =====
    ('班级作业学分管理', '记录每天的小进步'),
    ('班级学分管理', '学习记录'),
    ('查看全员学分记录', '查看全部积分记录'),
    ('学分明细', '积分明细'),
    ('学分流水', '积分流水'),
    ('学分变动', '积分变动'),
    ('暂无学分流水', '暂无积分记录'),
    ('总学分', '总积分'),
    ('学分与资料管理', '积分与资料'),
    ('学分', '积分'),

    # ===== 🟡 社交属性弱化：班级圈 → 成长圈 =====
    ('班级圈', '成长圈'),

    # ===== 🟡 机构属性弱化 =====
    ('首次微信登录，请在「我的」页面绑定学号以关联班级数据。',
     '首次登录，请在「我的」页面完善个人资料。'),
    ('填写真实姓名和学号，方便老师在后台识别和管理你的账号。资料仅老师和管理员可见。',
     '完善个人资料，方便识别你的记录。资料仅本人和管理员可见。'),
    ('如：老师课件', '如：课堂笔记'),
    ('班级场景管理动作少', '管理动作少'),
    ('关联班级数据', '关联个人数据'),
]

# 需要处理的文件后缀
EXTS = ('.wxml', '.json', '.js', '.wxss')
# 排除目录
EXCLUDE_DIRS = {'node_modules', 'miniprogram_npm', '.git', 'minitest'}


def should_process(path):
    parts = set(path.replace('\\', '/').split('/'))
    if parts & EXCLUDE_DIRS:
        return False
    return path.endswith(EXTS)


def main():
    changed_files = []
    total_hits = 0

    for dirpath, dirnames, filenames in os.walk(MP):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            fpath = os.path.join(dirpath, fn)
            if not should_process(fpath):
                continue
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    src = f.read()
            except (UnicodeDecodeError, PermissionError):
                continue

            new = src
            hits = []
            for old, rep in REPLACEMENTS:
                if old in new:
                    n = new.count(old)
                    new = new.replace(old, rep)
                    hits.append(f'{old} → {rep} (x{n})')
                    total_hits += n

            if new != src:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(new)
                rel = os.path.relpath(fpath, ROOT)
                changed_files.append((rel, hits))

    # 额外处理 project.config.json（在 miniprogram 内，已覆盖）
    print(f'=== 合规化改造完成 ===')
    print(f'修改文件数: {len(changed_files)}   替换总次数: {total_hits}\n')
    for rel, hits in changed_files:
        print(f'[{rel}]')
        for h in hits:
            print(f'    {h}')
        print()


if __name__ == '__main__':
    main()
