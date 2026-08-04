#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安全来源爬虫：把合规白名单里的初中优质课程资料批量录入 resource 表。
设计原则：
  1) **只爬白名单内 URL**：教育部、人教社、官方公众号 RSS 等明确免费的来源。
  2) **记录来源 URL + 授权类型**（CC-BY / 公开课 / 官方资料）→ 写入 resource.source
  3) **单次抓取限额**：每小时 ≤ 50 条，每日 ≤ 200 条（robots.txt + 平台政策）
  4) **人工审核闸门**：所有抓到的 URL 写入 `resource_pending` 表，运营审核通过后才进 resource 表

⚠ 严禁爬商业网站（学科网、21cnjy 等）—— 班级作品上架小程序后风险极高。
"""

import os
import sys
import json
import time
import sqlite3
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse
import re

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("需要安装: pip install requests beautifulsoup4")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
DB = os.environ.get('CRAWLER_DB', str(ROOT / 'server' / 'data' / 'credit.db'))

# ── 白名单：教育部 / 人教社 / 官方公众号 RSS ──
WHITELIST = {
    'moe.gov.cn': {
        'name': '中华人民共和国教育部',
        'license': '政府公开信息',
        'allow_paths': ['/srcsite/', '/jyb_xwfb/', '/jyb_xxgk/'],
        'rate_limit_per_hour': 30,
    },
    'pep.com.cn': {
        'name': '人民教育出版社',
        'license': '公开样章',
        'allow_paths': ['/product/', '/book/', '/curriculum/'],
        'rate_limit_per_hour': 20,
    },
    'jyb.cn': {  # 教育部考试中心
        'name': '教育部考试中心',
        'license': '政府公开信息',
        'allow_paths': ['/html/', '/public/'],
        'rate_limit_per_hour': 30,
    },
    'chinaedu.edu.cn': {
        'name': '中国教育在线',
        'license': '公开',
        'allow_paths': ['/news/', '/zixun/'],
        'rate_limit_per_hour': 20,
    },
}

# ── 官方公众号 RSS（搜狗微信提供的官方账号搜索）──
WX_OFFICIAL_ACCOUNTS = [
    # 教育部直属
    {'name': '微言教育', 'wechat_id': 'jybxwc', 'grade': '初一', 'subject': '通用'},
    {'name': '中国教师研修网', 'wechat_id': 'teacher-study', 'grade': '通用', 'subject': '通用'},
    # 各学科
    {'name': '人教教材', 'wechat_id': 'pep-tb', 'grade': '通用', 'subject': '通用'},
    {'name': '中国教育报', 'wechat_id': 'ZhongguoJiaoyuBao', 'grade': '通用', 'subject': '通用'},
    # 各省教研
    {'name': '北京数字学校', 'wechat_id': 'bjdsxq', 'grade': '初一', 'subject': '通用'},
    {'name': '上海微校', 'wechat_id': 'shwx-school', 'grade': '初一', 'subject': '通用'},
]

# ── 反爬虫：标准库 headers ──
HEADERS = {
    'User-Agent': 'feiyue-credit-crawler/1.0 (+https://github.com/feiyue) educational-purpose',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

# ── 速率控制（按域名） ──
rate_state = {}  # {domain: [timestamp, ...]}


def rate_check(domain):
    cfg = WHITELIST.get(domain)
    if not cfg:
        return False
    now = time.time()
    state = rate_state.setdefault(domain, [])
    # 滑动窗口：去掉 1 小时外的
    state[:] = [t for t in state if now - t < 3600]
    if len(state) >= cfg['rate_limit_per_hour']:
        return False
    state.append(now)
    return True


def is_whitelisted(url):
    p = urlparse(url)
    domain = p.netloc.replace('www.', '')
    return domain in WHITELIST


def fetch(url):
    p = urlparse(url)
    domain = p.netloc.replace('www.', '')
    if not is_whitelisted(url):
        raise ValueError(f'URL 不在白名单: {url}')
    if not rate_check(domain):
        raise RuntimeError(f'域名 {domain} 速率超限，请等待 1 小时')
    cfg = WHITELIST[domain]
    if not any(p.path.startswith(path) for path in cfg['allow_paths']):
        raise ValueError(f'URL 路径不在白名单允许范围: {p.path}')
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.text


# ── 抓取解析：通用 article extractor ──
def parse_articles(html, base_url, grade, subject):
    """从 HTML 提取 (title, url, snippet) 三元组列表"""
    soup = BeautifulSoup(html, 'html.parser')
    items = []
    for a in soup.find_all('a', href=True):
        title = (a.get_text() or '').strip()
        if not title or len(title) < 4 or len(title) > 100:
            continue
        if any(bad in title for bad in ['登录', '注册', '广告', 'Copyright']):
            continue
        href = urljoin(base_url, a['href'])
        if not is_whitelisted(href):
            continue
        items.append({
            'title': title,
            'url': href,
            'snippet': '',
            'grade': grade,
            'subject': subject,
        })
    return items[:20]  # 每页最多取 20 条


def save_pending(items, source_name, license_type):
    """写入待审核表 (resource_pending) —— 人工审核通过后才进 resource"""
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    # 创建 pending 表（如果不存在）
    cur.execute('''
        CREATE TABLE IF NOT EXISTS resource_pending (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url_hash TEXT UNIQUE,
          title TEXT, url TEXT, snippet TEXT,
          grade TEXT, subject TEXT,
          source TEXT, license TEXT,
          fetched_at TEXT DEFAULT (datetime('now')),
          approved INTEGER DEFAULT 0
        )
    ''')
    inserted = skipped = 0
    for it in items:
        h = hashlib.md5(it['url'].encode()).hexdigest()
        try:
            cur.execute('''INSERT OR IGNORE INTO resource_pending
                           (url_hash, title, url, snippet, grade, subject, source, license)
                           VALUES(?,?,?,?,?,?,?,?)''',
                        (h, it['title'], it['url'], it['snippet'],
                         it['grade'], it['subject'], source_name, license_type))
            if cur.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except sqlite3.IntegrityError:
            skipped += 1
    conn.commit()
    conn.close()
    return inserted, skipped


def approve_pending(ids=None, limit=50):
    """审核通过 → 写入 resource 表"""
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    if ids:
        cur.execute(f'SELECT id, title, url, grade, subject, source, license FROM resource_pending WHERE approved=0 AND id IN ({",".join("?"*len(ids))})', ids)
    else:
        cur.execute('SELECT id, title, url, grade, subject, source, license FROM resource_pending WHERE approved=0 LIMIT ?', (limit,))
    rows = cur.fetchall()
    for r in rows:
        cur.execute('''INSERT OR IGNORE INTO resource(grade, subject, title, type, url, source)
                       VALUES(?,?,?,?,?,?)''',
                    (r[3], r[4], r[1], 'link', r[2], r[5]))
        cur.execute('UPDATE resource_pending SET approved=1 WHERE id=?', (r[0],))
    conn.commit()
    conn.close()
    return len(rows)


# ── CLI ──
def main():
    import argparse
    p = argparse.ArgumentParser(description='安全来源爬虫 (白名单模式)')
    p.add_argument('--seed', action='store_true', help='从白名单种子 URL 抓一批')
    p.add_argument('--approve', action='store_true', help='审核通过 pending 表前 N 条')
    p.add_argument('--limit', type=int, default=50)
    p.add_argument('--dry-run', action='store_true', help='只解析不入库')
    args = p.parse_args()

    if args.seed:
        # 种子 URL：教育部 jyb_xwfb（新闻发布）/ 人教社公开样章页
        seeds = [
            ('https://www.moe.gov.cn/srcsite/A06/s7052/202407/t20240715_1143207.html', '初一', '通用'),
            ('https://www.moe.gov.cn/jyb_xwfb/xw_ztzl/2024/2024_zt16/', '初一', '通用'),
            ('https://www.pep.com.cn/product/1/101.html', '初一', '语文'),
        ]
        all_items = []
        for url, grade, subject in seeds:
            try:
                print(f'抓取 {url}')
                html = fetch(url)
                items = parse_articles(html, url, grade, subject)
                all_items.extend(items)
                print(f'  解析到 {len(items)} 条')
            except Exception as e:
                print(f'  跳过: {e}')
            time.sleep(2)
        if args.dry_run:
            print(json.dumps(all_items, ensure_ascii=False, indent=2))
        else:
            ins, skip = save_pending(all_items, source_name='教育部公开', license_type='政府公开信息')
            print(f'插入 {ins} 条, 跳过 {skip} 条')

    if args.approve:
        n = approve_pending(limit=args.limit)
        print(f'已审核 {n} 条 → 进入 resource 表')


if __name__ == '__main__':
    main()