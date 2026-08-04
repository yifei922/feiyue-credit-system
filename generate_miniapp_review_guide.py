#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《微信小程序发布审核完整指南》PDF"""
import os, sys
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

ROOT = Path(__file__).parent
OUT = ROOT / "洛一高附中八（十）班-微信小程序发布审核指南.pdf"
# 字体：与之前两份 PDF 一致
NOTO_CANDIDATES = [Path("C:/Windows/Fonts/NotoSansSC-VF.ttf"), Path("C:/Windows/Fonts/NotoSansCJKsc-Regular.otf")]
FONT = next((p for p in NOTO_CANDIDATES if p.exists()), NOTO_CANDIDATES[0])

try:
    pdfmetrics.registerFont(TTFont('NotoSC', str(FONT)))
    BODY = 'NotoSC'
except Exception:
    BODY = 'Helvetica'

NAVY = colors.HexColor('#051C2C')
BLUE = colors.HexColor('#2E6CA4')
ACCENT = colors.HexColor('#c8102e')
GREY = colors.HexColor('#5b6478')
LIGHT = colors.HexColor('#f6f8ff')

S = {
    'cover_title': ParagraphStyle('ct', fontName=BODY, fontSize=28, textColor=NAVY, leading=36, alignment=TA_CENTER, spaceAfter=8),
    'cover_sub': ParagraphStyle('cs', fontName=BODY, fontSize=14, textColor=GREY, leading=20, alignment=TA_CENTER),
    'h1': ParagraphStyle('h1', fontName=BODY, fontSize=18, textColor=NAVY, leading=24, spaceBefore=14, spaceAfter=10),
    'h2': ParagraphStyle('h2', fontName=BODY, fontSize=13, textColor=BLUE, leading=18, spaceBefore=8, spaceAfter=6),
    'h3': ParagraphStyle('h3', fontName=BODY, fontSize=11, textColor=NAVY, leading=15, spaceBefore=6, spaceAfter=4),
    'body': ParagraphStyle('b', fontName=BODY, fontSize=10, leading=15, spaceAfter=4),
    'note': ParagraphStyle('n', fontName=BODY, fontSize=9, leading=13, textColor=ACCENT, spaceAfter=4),
    'step': ParagraphStyle('s', fontName=BODY, fontSize=11, leading=17, textColor=NAVY, spaceAfter=4),
    'caption': ParagraphStyle('c', fontName=BODY, fontSize=9, leading=12, textColor=GREY, alignment=TA_CENTER, spaceBefore=4),
}

def callout(text):
    return Paragraph(f'<para leftIndent="14" rightIndent="14" spaceBefore="4" spaceAfter="8"><font color="{ACCENT.hexval()}">▎ </font><b>{text}</b></para>', S['body'])

def screen(label, content):
    """模拟截图框：标签 + 灰色虚线框 + 内容"""
    box = Table([[Paragraph(f'<b>{label}</b>', S['h3'])],
                 [Paragraph(content, S['body'])]],
                colWidths=[16*cm])
    box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fbfbfd')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#dde3ec')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return box

def table_styled(data, col_widths, header_bg=NAVY):
    t = Table(data, colWidths=col_widths)
    style = [
        ('FONTNAME', (0, 0), (-1, -1), BODY),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#dde3ec')),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for r in range(1, len(data)):
        if r % 2 == 0:
            style.append(('BACKGROUND', (0, r), (-1, r), LIGHT))
    t.setStyle(TableStyle(style))
    return t


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 5 * cm, A4[0], 5 * cm, fill=True, stroke=False)
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 5.3 * cm, A4[0], 0.3 * cm, fill=True, stroke=False)
    canvas.restoreState()


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 8)
    canvas.setFillColor(GREY)
    canvas.drawString(2 * cm, 1 * cm, "洛一高附中八（十）班 · 微信小程序发布审核指南")
    canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"P {doc.page}")
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - 0.4 * cm, A4[0], 0.4 * cm, fill=True, stroke=False)
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(str(OUT), pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm,
                            title="微信小程序发布审核指南",
                            author="斐越科技")
    s = []
    s.append(Spacer(1, 5 * cm))
    s.append(Paragraph("微信小程序发布审核完整指南", S['cover_title']))
    s.append(Spacer(1, 0.4 * cm))
    s.append(Paragraph("洛一高附中八（十）班 · 学分管理系统 · 微信小程序", S['cover_sub']))
    s.append(Paragraph("AppID: wx0fe78d74fdc47c1b", S['cover_sub']))
    s.append(Spacer(1, 1 * cm))
    s.append(Paragraph("斐越科技 出品", S['cover_sub']))
    s.append(PageBreak())

    # 一、为什么需要审核
    s.append(Paragraph("一、为什么要做发布审核？", S['h1']))
    s.append(Paragraph("微信官方要求：所有小程序（包括个人类型）必须在发布前通过微信官方审核（<b>微信认证</b>），未通过的小程序只能以「体验版」形式给到指定微信号体验，无法被普通用户搜索到。", S['body']))
    s.append(Paragraph("因此，提交「体验版」后还需要额外做：<b>提交审核 → 等待通过 → 发布上线</b>三步。审核通常 <b>1–7 天</b>，首次审核一般 1–2 天，复审通常 2 小时。", S['body']))
    s.append(callout("本指南会逐步告诉你：① 准备哪些材料 ② 怎么填写审核信息 ③ 常见驳回原因与对策 ④ 上线后监控"))

    # 二、前置清单
    s.append(Paragraph("二、上线前必备清单", S['h1']))
    s.append(Paragraph("在打开微信开发者工具提交审核之前，请确认以下事项都已就位：", S['body']))
    check_data = [
        ['项目', '状态', '位置'],
        ['小程序 AppID 正确', '✅', 'project.config.json → appid'],
        ['后端 HTTPS 服务正常', '✅', 'https://feiyue-credit.onrender.com'],
        ['微信公众平台已配置服务器域名', '✅', 'mp.weixin.qq.com → 开发管理 → 开发设置'],
        ['业务域名已配置（如有 webview）', '⚠ 可选', '同上'],
        ['微信小程序 AppSecret 已重置并配置到 Render', '⚠', 'WX_APP_SECRET 环境变量'],
        ['tab 图标 / 头像 / Logo 已上传', '⚠', 'assets/ 目录'],
        ['所有 adUnitId 已配置（如要开通广告）', '⚠ 可选', 'config/ad-config.js'],
        ['体验版已多人体验无异常', '✅', '体验成员至少 3 人'],
    ]
    s.append(table_styled(check_data, [7 * cm, 2 * cm, 7 * cm]))
    s.append(Spacer(1, 0.2 * cm))
    s.append(callout("⚠ 任何一项 ⚠/❌ 都必须先解决再提交审核，否则必被驳回"))

    # 三、提交审核的 6 步
    s.append(Paragraph("三、提交审核的 6 步操作", S['h1']))

    # 步骤 1
    s.append(Paragraph("步骤 1 · 微信开发者工具上传代码", S['h2']))
    s.append(Paragraph("1. 打开微信开发者工具 → 点击右上角「上传」按钮", S['body']))
    s.append(Paragraph("2. 填写版本号（如 1.0.0）和项目备注（如「首版上线：学分管理 + 班级圈 + 资料」）", S['body']))
    s.append(Paragraph("3. 上传成功后到 mp.weixin.qq.com → 版本管理 即可看到刚上传的版本", S['body']))
    s.append(screen("📷 图示：上传弹窗",
                   "上传弹窗中：①版本号必填 ②项目备注给审核员看（写功能清单）③AppID 自动填好 ④点击「上传」"))

    # 步骤 2
    s.append(Paragraph("步骤 2 · 进入「提交审核」入口", S['h2']))
    s.append(Paragraph("1. mp.weixin.qq.com → 版本管理", S['body']))
    s.append(Paragraph("2. 找到刚上传的开发版本 → 点击「提交审核」按钮", S['body']))
    s.append(screen("📷 图示：版本管理页面",
                   "页面会列出：①开发版本（刚上传）②审核版本（提交后）③线上版本（已发布）。点击开发版本右侧的「提交审核」"))

    # 步骤 3
    s.append(Paragraph("步骤 3 · 填写审核信息（最关键）", S['h2']))
    s.append(Paragraph("提交审核会弹出一个表单，<b>每一项都要认真填写</b>，否则容易被驳回：", S['body']))
    form_data = [
        ['字段', '填写内容', '注意事项'],
        ['类目', '工具 → 教育', '必须与实际功能匹配；选「教育」是因为含「课程资料」'],
        ['标签', '校园管理 / 班级 / 学分', '最多 5 个，覆盖核心场景'],
        ['主要功能描述', '本小程序提供班级作业、学分管理、班级圈社交、初中课程资料推荐功能（详见下方）', '100–500 字，写明全部主要功能'],
        ['测试账号', 'student01 / 123456', '供审核员体验；提供可登录的账号'],
        ['辅助网址', 'https://feiyue-credit.onrender.com', '如有 web 端可填；展示完整功能截图'],
        ['补充说明', '含演示数据截图 / 操作流程图', '审核员不愿装客户端时，看截图能快速过审'],
    ]
    s.append(table_styled(form_data, [3 * cm, 8 * cm, 5 * cm]))
    s.append(Spacer(1, 0.2 * cm))

    s.append(Paragraph("📝 主要功能描述参考模板：", S['h3']))
    s.append(screen("💡 文案模板（直接复制）",
                   """本小程序为「洛一高附中八（十）班」班级专用作业学分管理工具，主要功能包括：

1. 【作业提交】学生在小程序内查看教师布置的作业任务，上传图片 / 视频 / 文档作为附件；
2. 【学分明细】实时查看个人学分流水与累计总分；
3. 【班级圈】同学间发布图文动态、点赞、评论，构建班级社交氛围；
4. 【课程资料】按年级（初一/初二/初三）+ 科目（语数英物化政史地生）展示初中优质免费资料；
5. 【我的】查看个人信息、积分余额、操作历史。

所有功能均使用本人本班真实账号（student01 / 123456）体验，数据已脱敏。"""))

    # 步骤 4
    s.append(Paragraph("步骤 4 · 上传「预览截图」与「演示视频」", S['h2']))
    s.append(Paragraph("• <b>预览截图</b>：5–10 张，建议包含首页 / 任务 / 班级圈 / 资料 / 我的 5 个 Tab", S['body']))
    s.append(Paragraph("• <b>演示视频</b>：可选；如果上传，建议录一个 30 秒以内的「核心操作流程」（用手机录屏）", S['body']))
    s.append(screen("📷 截图要求",
                   "① 尺寸 750×1334 (iPhone 6) 或 1080×1920 (主流); ② 真实界面、不要带调试浮窗; ③ 不能用预览图工具生成的 mock 截图"))

    # 步骤 5
    s.append(Paragraph("步骤 5 · 等待审核结果", S['h2']))
    s.append(Paragraph("审核时长：<b>1–7 天</b>，一般 1–2 天。", S['body']))
    s.append(Paragraph("• 审核通过 → 公众号 / 服务通知推送 → 在「版本管理」点击「发布」按钮即可上线", S['body']))
    s.append(Paragraph("• 审核驳回 → 在「通知中心」或「设置」查看原因 → 修复后重新上传 → 再次提交审核", S['body']))
    s.append(callout("⚠ 驳回后修改了代码，必须重新「上传」→ 再次「提交审核」，不能直接重提"))

    # 步骤 6
    s.append(Paragraph("步骤 6 · 上线后必做 3 件事", S['h2']))
    s.append(Paragraph("1. <b>接入客服消息</b>：设置 → 客服消息 → 添加客服微信号（用于用户咨询）", S['body']))
    s.append(Paragraph("2. <b>配置业务域名</b>：开发管理 → 开发设置 → 添加 <font color='#c8102e'>feiyue-credit.onrender.com</font>（如果有 webview 跳转）", S['body']))
    s.append(Paragraph("3. <b>设置搜索关键词</b>：设置 → 基本设置 → 添加「班级学分 / 学分管理 / 班级管理」等 5–10 个关键词", S['body']))

    # 四、常见驳回原因
    s.append(Paragraph("四、常见驳回原因与对策", S['h1']))
    reject_data = [
        ['驳回原因', '概率', '对策'],
        ['类目不符（如选了「工具」但内容偏教育）', '高', '「教育 → 教育服务 / 教育信息查询」类目'],
        ['主要功能描述模糊', '高', '按本文模板逐条写明，禁止"提升效率"等空话'],
        ['未提供测试账号', '高', '必填 student01 / 123456'],
        ['截图与代码不符（界面不一致）', '中', '截图前先重启小程序清缓存，确保是当前版本'],
        ['包含诱导分享/关注公众号', '中', '禁止"邀请好友得学分"等违规文案'],
        ['个人主体含商业推广', '低', '本项目纯工具，无广告无付费，放心'],
        ['用户协议缺失', '低', '「设置 → 服务条款」添加隐私协议（写 200 字即可）'],
    ]
    s.append(table_styled(reject_data, [4 * cm, 2 * cm, 10 * cm]))

    # 五、上线后运营清单
    s.append(Paragraph("五、上线后日常运营清单", S['h1']))
    s.append(Paragraph("• 每周查看「用户反馈」及时回复", S['body']))
    s.append(Paragraph("• 每月 1 号导出「运营月报」（DAU / 提交量 / 班级圈活跃度 / 资料观看量）", S['body']))
    s.append(Paragraph("• 每季度更新一次资料库（人工审核 + 爬虫补充白名单内容）", S['body']))
    s.append(Paragraph("• 累计 1000 UV 后申请「激励视频」广告位（详见 WECHAT_AD_GUIDE.md）", S['body']))

    # 六、附录：测试账号
    s.append(Paragraph("六、附录：测试账号清单", S['h1']))
    test_data = [
        ['角色', '账号', '密码', '登录后可见'],
        ['管理员', 'superadmin', 'Feiyue@2026', '所有功能'],
        ['教师', 'teacher01', '123456', '任务管理 / 完成登记 / 预警'],
        ['课代表', 'rep01', '123456', '本科目任务'],
        ['学生', 'student01', '123456', '学生端 + 班级圈 + 资料'],
        ['学生', 'student02', '123456', '同上（备用）'],
    ]
    s.append(table_styled(test_data, [3 * cm, 3 * cm, 3 * cm, 7 * cm]))

    doc.build(s, onFirstPage=cover, onLaterPages=header_footer)
    print(f"[pdf] 已生成：{OUT}")
    print(f"[pdf] 大小：{OUT.stat().st_size / 1024:.1f} KB")


if __name__ == '__main__':
    build()