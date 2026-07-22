# -*- coding: utf-8 -*-
"""
洛一高附中八（十）班 · 学分管理系统 使用指南 PDF 生成器
麦肯锡（McKinsey）风格排版：深海军蓝 + 横向细线 + 行动标题 + Confidential 页脚
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---- 字体注册（中文支持）----
FONT_PATHS = [
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/simsun.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
]
FONT_NAME = "ChineseFont"
REGISTERED = False
for fp in FONT_PATHS:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont(FONT_NAME, fp))
            REGISTERED = True
            print(f"[pdf] Font loaded: {fp}")
            break
        except Exception as e:
            print(f"[pdf] Font load failed: {fp} -> {e}")
            continue
if not REGISTERED:
    print("[pdf] WARNING: No Chinese font found, using Helvetica fallback")
    FONT_NAME = "Helvetica"

# ---- 麦肯锡配色 ----
NAVY = colors.HexColor("#051C2C")     # 麦肯锡深海军蓝
STEEL = colors.HexColor("#2E6CA4")    # 钢蓝（副色）
INK = colors.HexColor("#1A1A1A")      # 近黑正文
GRAY = colors.HexColor("#6B7280")     # 次级灰
LIGHT = colors.HexColor("#F4F5F7")    # 浅灰底
RULE = colors.HexColor("#C9CDD3")     # 细线灰
WHITE = colors.white

CONTENT_W = 160 * mm   # A4(210) - 25 - 25

# ---- 样式 ----
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(name="ConfTag", fontName=FONT_NAME, fontSize=8, leading=10,
                          alignment=0, textColor=NAVY, spaceAfter=4))
styles.add(ParagraphStyle(name="CoverTitle", fontName=FONT_NAME, fontSize=30, leading=38,
                          alignment=0, textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle(name="CoverSub", fontName=FONT_NAME, fontSize=15, leading=22,
                          alignment=0, textColor=GRAY, spaceAfter=4))
styles.add(ParagraphStyle(name="CoverMetaLabel", fontName=FONT_NAME, fontSize=10, leading=16,
                          alignment=2, textColor=NAVY))
styles.add(ParagraphStyle(name="CoverMetaValue", fontName=FONT_NAME, fontSize=10, leading=16,
                          alignment=0, textColor=INK))
styles.add(ParagraphStyle(name="CoverFoot", fontName=FONT_NAME, fontSize=9, leading=14,
                          alignment=0, textColor=GRAY))

# 章节行动标题：海军蓝 + 粗体，下接细线（细线由 hr() 单独画）
styles.add(ParagraphStyle(name="H1", fontName=FONT_NAME, fontSize=18, leading=24,
                          alignment=0, textColor=NAVY, spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="H2", fontName=FONT_NAME, fontSize=12.5, leading=18,
                          alignment=0, textColor=STEEL, spaceBefore=12, spaceAfter=4))
styles.add(ParagraphStyle(name="Body", fontName=FONT_NAME, fontSize=10, leading=17,
                          alignment=0, textColor=INK, spaceBefore=2, spaceAfter=6))
styles.add(ParagraphStyle(name="BodyBullet", fontName=FONT_NAME, fontSize=10, leading=17,
                          alignment=0, textColor=INK, leftIndent=12, spaceAfter=3))
styles.add(ParagraphStyle(name="TipText", fontName=FONT_NAME, fontSize=9.5, leading=15,
                          alignment=0, textColor=INK, leftIndent=4))
styles.add(ParagraphStyle(name="TableCell", fontName=FONT_NAME, fontSize=9.5, leading=14,
                          alignment=0, textColor=INK))
styles.add(ParagraphStyle(name="TableHeader", fontName=FONT_NAME, fontSize=9.5, leading=14,
                          alignment=1, textColor=WHITE))
styles.add(ParagraphStyle(name="Closing", fontName=FONT_NAME, fontSize=9, leading=14,
                          alignment=1, textColor=GRAY))


def hr(thickness=0.8, color=RULE, width=CONTENT_W):
    """麦肯锡式细线分隔（单独一行表格，背景即线条色）"""
    t = Table([[""]], colWidths=[width], rowHeights=[thickness])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color),
                           ("LINEBEFORE", (0, 0), (-1, -1), 0, colors.white),
                           ("LINEAFTER", (0, 0), (-1, -1), 0, colors.white)]))
    return t


def section(num, title):
    """章节标题：编号 + 标题 + 下方细线（行动标题风格）"""
    flow = []
    flow.append(Paragraph(f"{num}&nbsp;&nbsp;{title}", styles["H1"]))
    flow.append(Spacer(1, 1.5 * mm))
    flow.append(hr(1.4, NAVY))
    flow.append(Spacer(1, 4 * mm))
    return flow


def callout(para):
    """麦肯锡式侧栏提示框：浅灰底 + 左侧海军蓝粗线"""
    t = Table([[para]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("LINEBEFORE", (0, 0), (0, -1), 3, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def mckinsey_table(data, col_widths, header_align="CENTER"):
    """麦肯锡表：海军蓝表头 + 白色字 + 仅横向细线（无竖线）"""
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ALIGN", (0, 0), (-1, 0), header_align),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def on_page(canvas, doc):
    """页脚：细线 + Source 来源 + 页码（麦肯锡 Confidential 风格）"""
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(25 * mm, 15 * mm, 185 * mm, 15 * mm)
    canvas.setFont(FONT_NAME, 7.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(25 * mm, 11 * mm, "Source: 洛一高附中八（十）班学分管理系统  |  Confidential")
    canvas.drawRightString(185 * mm, 11 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_guide(output_path):
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                            leftMargin=25 * mm, rightMargin=25 * mm,
                            topMargin=25 * mm, bottomMargin=20 * mm)
    story = []

    # ==================== 封面 ====================
    story.append(Spacer(1, 32 * mm))
    story.append(Paragraph("CONFIDENTIAL", styles["ConfTag"]))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("洛一高附中八（十）班", styles["CoverTitle"]))
    story.append(Paragraph("班级作业学分管理系统 · 使用指南", styles["CoverSub"]))
    story.append(Spacer(1, 4 * mm))
    story.append(hr(1.6, NAVY))
    story.append(Spacer(1, 10 * mm))

    meta = [
        [Paragraph("版本", styles["CoverMetaLabel"]), Paragraph("V2.0", styles["CoverMetaValue"])],
        [Paragraph("适用对象", styles["CoverMetaLabel"]), Paragraph("班主任 / 科任教师 / 课代表 / 学生", styles["CoverMetaValue"])],
        [Paragraph("开发团队", styles["CoverMetaLabel"]), Paragraph("斐越科技", styles["CoverMetaValue"])],
        [Paragraph("更新日期", styles["CoverMetaLabel"]), Paragraph("2026 年 7 月", styles["CoverMetaValue"])],
    ]
    mt = Table(meta, colWidths=[35 * mm, 125 * mm])
    mt.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
    ]))
    story.append(mt)
    story.append(Spacer(1, 38 * mm))
    story.append(Paragraph("斐越科技 出品", styles["CoverFoot"]))
    story.append(PageBreak())

    # ==================== 目录 ====================
    story += section("目 录", "Contents")
    toc = [
        ("一、系统概述", "功能定位与核心价值"),
        ("二、账号与登录", "默认账号、角色权限与安全说明"),
        ("三、数据看板", "班级总览、任务完成情况、学分趋势"),
        ("四、任务管理", "创建任务、模板、其他自定义项"),
        ("五、完成登记", "记录学生任务完成状态"),
        ("六、学生管理", "学生档案、手动调分"),
        ("七、学生端", "学生查看个人学分明细"),
        ("八、预警中心", "连续未完成、即将截止提醒"),
        ("九、系统设置", "科目配置、课代表任命、账号管理"),
        ("十、移动端适配", "手机 / 平板访问说明"),
        ("十一、常见问题", "FAQ 与部署指引"),
    ]
    for title, desc in toc:
        story.append(Paragraph(f"<b>{title}</b>", styles["Body"]))
        story.append(Paragraph(f"　　{desc}", styles["TipText"]))
        story.append(Spacer(1, 2 * mm))
    story.append(PageBreak())

    # ==================== 一、系统概述 ====================
    story += section("一、", "系统概述")
    story.append(Paragraph("1.1 什么是学分管理系统？", styles["H2"]))
    story.append(Paragraph(
        "洛一高附中八（十）班学分管理系统是一套专为初中班级设计的作业管理与学分量化工具。"
        "系统将日常学习任务（作业、背书、测验等）转化为可追踪的学分记录，帮助班主任和科任教师"
        "全面掌握每位学生的学习状态，实现精细化管理。", styles["Body"]))
    story.append(Paragraph(
        "本系统由<b>斐越科技</b>开发，采用前后端分离架构，支持电脑端和手机端访问，"
        "数据存储在本地 SQLite 数据库中，无需联网即可运行。同时支持一键部署到云端服务器（Render），"
        "方便师生随时随地使用。", styles["Body"]))

    story.append(Paragraph("1.2 核心功能模块", styles["H2"]))
    func = [
        [Paragraph("<b>模块</b>", styles["TableHeader"]), Paragraph("<b>功能描述</b>", styles["TableHeader"]), Paragraph("<b>适用角色</b>", styles["TableHeader"])],
        [Paragraph("数据看板", styles["TableCell"]), Paragraph("班级总览、各科目完成率、学分趋势图", styles["TableCell"]), Paragraph("全部", styles["TableCell"])],
        [Paragraph("任务管理", styles["TableCell"]), Paragraph("新建 / 编辑任务、从模板创建、存为模板", styles["TableCell"]), Paragraph("老师 / 课代 / 管理员", styles["TableCell"])],
        [Paragraph("完成登记", styles["TableCell"]), Paragraph("批量登记完成状态（按时 / 逾期 / 未通过）", styles["TableCell"]), Paragraph("老师 / 课代 / 管理员", styles["TableCell"])],
        [Paragraph("学生管理", styles["TableCell"]), Paragraph("学生档案、手动增减学分、导出报表", styles["TableCell"]), Paragraph("老师 / 课代 / 管理员", styles["TableCell"])],
        [Paragraph("学生端", styles["TableCell"]), Paragraph("查看个人学分明细、历史流水", styles["TableCell"]), Paragraph("全部", styles["TableCell"])],
        [Paragraph("预警中心", styles["TableCell"]), Paragraph("连续未完成、即将截止自动预警", styles["TableCell"]), Paragraph("老师 / 课代 / 管理员", styles["TableCell"])],
        [Paragraph("系统设置", styles["TableCell"]), Paragraph("科目管理、课代表任命、账号管理、操作日志", styles["TableCell"]), Paragraph("老师 / 管理员", styles["TableCell"])],
    ]
    story.append(mckinsey_table(func, [35 * mm, 85 * mm, 40 * mm]))
    story.append(Spacer(1, 4 * mm))

    # ==================== 二、账号与登录 ====================
    story += section("二、", "账号与登录")
    story.append(Paragraph("2.1 默认账号列表", styles["H2"]))
    acct = [
        [Paragraph("<b>用户名</b>", styles["TableHeader"]), Paragraph("<b>角色</b>", styles["TableHeader"]), Paragraph("<b>密码</b>", styles["TableHeader"]), Paragraph("<b>说明</b>", styles["TableHeader"])],
        [Paragraph("admin", styles["TableCell"]), Paragraph("管理员", styles["TableCell"]), Paragraph("123456", styles["TableCell"]), Paragraph("最高权限，可管理所有设置", styles["TableCell"])],
        [Paragraph("teacher01", styles["TableCell"]), Paragraph("教师（杨老师）", styles["TableCell"]), Paragraph("123456", styles["TableCell"]), Paragraph("主科任教师，可管理所有科目", styles["TableCell"])],
        [Paragraph("rep01 / rep02", styles["TableCell"]), Paragraph("课代表", styles["TableCell"]), Paragraph("123456", styles["TableCell"]), Paragraph("仅可管理所负责的科目", styles["TableCell"])],
        [Paragraph("student01 ~ student06", styles["TableCell"]), Paragraph("学生", styles["TableCell"]), Paragraph("123456", styles["TableCell"]), Paragraph("查看个人学分，不可操作他人", styles["TableCell"])],
        [Paragraph("superadmin", styles["TableCell"]), Paragraph("超级管理员", styles["TableCell"]), Paragraph("Feiyue@2026", styles["TableCell"]), Paragraph("开发者账号，拥有所有权限", styles["TableCell"])],
    ]
    story.append(mckinsey_table(acct, [30 * mm, 30 * mm, 28 * mm, 72 * mm]))
    story.append(Spacer(1, 4 * mm))
    story.append(callout(Paragraph("⚠ 安全提示：首次使用后请立即修改默认密码。", styles["TipText"])))

    story.append(Paragraph("2.2 角色权限说明", styles["H2"]))
    story.append(Paragraph("系统采用基于角色的访问控制（RBAC）。不同角色的用户看到的菜单与可执行操作不同：", styles["Body"]))
    story.append(Paragraph("<b>管理员（ADMIN）</b>：拥有所有权限，包括账号管理、科目配置、课代表任命。适合班主任使用。", styles["Body"]))
    story.append(Paragraph("<b>教师（TEACHER）</b>：可管理任务、登记完成、调分、查看所有数据与日志，但不能管理账号。", styles["Body"]))
    story.append(Paragraph("<b>课代表（REP）</b>：只能管理被分配负责科目的任务与完成记录，不能跨科目操作。", styles["Body"]))
    story.append(Paragraph("<b>学生（STUDENT）</b>：仅可查看自己的学分情况与任务完成记录，无法修改任何数据。", styles["Body"]))

    # ==================== 三、数据看板 ====================
    story += section("三、", "数据看板")
    story.append(Paragraph("3.1 统计卡片", styles["H2"]))
    story.append(Paragraph("进入系统后首先映入眼帘的是三个统计卡片：<b>在读学生人数</b>、<b>本学期任务数</b>、<b>平均学分</b>。这些数据实时更新，让您对班级整体状况一目了然。", styles["Body"]))
    story.append(Paragraph("3.2 任务完成情况总览", styles["H2"]))
    story.append(Paragraph("总览区域展示三个关键指标：<b>班级总人数</b>、<b>已全部完成任务的学生</b>、<b>尚有未完成的学生</b>。下方是「各任务完成小计」表格，显示每个任务的已完成 / 未完成人数及完成率进度条。点击「一键提醒未完成学生」可批量发送提醒通知。", styles["Body"]))
    story.append(Paragraph("3.3 图表分析", styles["H2"]))
    story.append(Paragraph("<b>各科目完成率对比（柱状图）</b>：横向对比语文、数学、英语等各科目完成率，点击柱体可下钻查看该科目每个任务完成详情。", styles["BodyBullet"]))
    story.append(Paragraph("<b>任务完成状态分布（饼图）</b>：按时完成、逾期完成、未完成、未通过四种状态占比，点击扇区可查看对应学生名单。", styles["BodyBullet"]))
    story.append(Paragraph("<b>学生学分积累趋势（折线图）</b>：选择任意学生，查看其学分随时间的变化曲线。", styles["BodyBullet"]))

    # ==================== 四、任务管理 ====================
    story += section("四、", "任务管理")
    story.append(Paragraph("4.1 新建任务", styles["H2"]))
    story.append(Paragraph("点击「+ 新建任务」按钮，填写以下信息：", styles["Body"]))
    story.append(Paragraph("• <b>标题</b>：任务名称，如「第三章习题」「《赤壁赋》背诵」", styles["BodyBullet"]))
    story.append(Paragraph("• <b>科目</b>：语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 道德与法治 / 历史 / 地理 / 体育 / 音乐 / 美术 / 信息科技 / 其他", styles["BodyBullet"]))
    story.append(Paragraph("• <b>类型</b>：作业 / 背书 / 测验 / 其他", styles["BodyBullet"]))
    story.append(Paragraph("• <b>学分</b>：按时完成的满分值", styles["BodyBullet"]))
    story.append(Paragraph("• <b>截止时间</b>：可选，用于逾期判断与预警", styles["BodyBullet"]))
    story.append(Paragraph("• <b>说明</b>：补充描述", styles["BodyBullet"]))

    story.append(Paragraph("4.2 其他项（自定义任务）", styles["H2"]))
    story.append(Paragraph("除固定学科分类外，系统提供<b>「其他」</b>选项，用于创建非学科类自定义任务。选择「其他」后会出现<b>「自定义类别」</b>输入框，可输入任意类别名称，如：", styles["Body"]))
    story.append(Paragraph("• 劳动实践（卫生值日、黑板报设计）", styles["BodyBullet"]))
    story.append(Paragraph("• 班级事务（班会参与、活动组织）", styles["BodyBullet"]))
    story.append(Paragraph("• 行为规范（纪律表现、出勤情况）", styles["BodyBullet"]))
    story.append(Paragraph("• 自定义奖励（竞赛获奖、志愿服务）", styles["BodyBullet"]))
    story.append(Spacer(1, 2 * mm))
    story.append(callout(Paragraph("自定义类别名称会保存在任务说明字段中，方便后续筛选与识别。", styles["TipText"])))

    story.append(Paragraph("4.3 任务模板", styles["H2"]))
    story.append(Paragraph("常用任务可「存为模板」，之后用「从模板创建」快速生成同类任务。系统预置示例模板：《赤壁赋》背诵·模板 与 第三章习题·模板。", styles["Body"]))

    story.append(Paragraph("4.4 学分计算规则", styles["H2"]))
    rule = [
        [Paragraph("<b>完成状态</b>", styles["TableHeader"]), Paragraph("<b>获得学分</b>", styles["TableHeader"]), Paragraph("<b>说明</b>", styles["TableHeader"])],
        [Paragraph("按时完成", styles["TableCell"]), Paragraph("100%（满分）", styles["TableCell"]), Paragraph("在截止日期前提交 / 完成，获全额学分", styles["TableCell"])],
        [Paragraph("逾期完成", styles["TableCell"]), Paragraph("50%", styles["TableCell"]), Paragraph("超过截止时间后完成，按半额计分（向下取整）", styles["TableCell"])],
        [Paragraph("未完成", styles["TableCell"]), Paragraph("0 分", styles["TableCell"]), Paragraph("未在规定时间内完成，不计学分", styles["TableCell"])],
        [Paragraph("未通过", styles["TableCell"]), Paragraph("0 分", styles["TableCell"]), Paragraph("完成但质量不达标，需重做", styles["TableCell"])],
    ]
    story.append(mckinsey_table(rule, [35 * mm, 35 * mm, 90 * mm]))

    # ==================== 五、完成登记 ====================
    story += section("五、", "完成登记")
    story.append(Paragraph("在「完成登记」页面，教师或课代表可批量记录学生任务完成状态。选择任务后，系统列出全班学生，可为每人标记：按时完成（DONE_ONTIME）/ 逾期完成（DONE_OVERDUE）/ 未完成（UNFINISHED）/ 未通过（FAILED）。保存后系统自动计算每位学生应得学分，并生成学分流水记录。", styles["Body"]))

    # ==================== 六、学生管理 ====================
    story += section("六、", "学生管理")
    story.append(Paragraph("「学生管理」页面展示全班学生档案信息，包括姓名、学号、当前总学分。可在此进行以下操作：", styles["Body"]))
    story.append(Paragraph("• <b>手动调分</b>：非任务类学分变动（奖励、惩罚、补录）可使用「手动调整学分」功能，输入增减分数与原因，系统生成对应流水记录。", styles["BodyBullet"]))
    story.append(Paragraph("• <b>导出报表</b>：将学生学分数据导出为 CSV 文件，便于在 Excel 中进一步分析或上报。", styles["BodyBullet"]))

    # ==================== 七、学生端 ====================
    story += section("七、", "学生端")
    story.append(Paragraph("学生登录后进入「学生端」页面，可查看：", styles["Body"]))
    story.append(Paragraph("• 个人基本信息（姓名、学号、当前总学分）", styles["BodyBullet"]))
    story.append(Paragraph("• 所有任务完成状态一览", styles["BodyBullet"]))
    story.append(Paragraph("• 学分流水明细（每次学分变动：来源任务、变动金额、类型、时间）", styles["BodyBullet"]))
    story.append(Spacer(1, 2 * mm))
    story.append(callout(Paragraph("学生端为只读模式，无法修改任何数据，保证数据公正性。", styles["TipText"])))

    # ==================== 八、预警中心 ====================
    story += section("八、", "预警中心")
    story.append(Paragraph("系统自动监测学生学习状态，产生两类预警：", styles["Body"]))
    story.append(Paragraph("• <b>DANGER（危险级）</b>：某学生连续多个任务未完成（如「赵六连续 3 个任务未完成」），需重点关注、及时干预。", styles["BodyBullet"]))
    story.append(Paragraph("• <b>WARN（警告级）</b>：某任务即将到期但仍有学生未完成（如「《单元测试卷》将于明日截止且李四尚未完成」）。可单个发送提醒，也可点击「一键提醒」批量发送。", styles["BodyBullet"]))

    # ==================== 九、系统设置 ====================
    story += section("九、", "系统设置")
    story.append(Paragraph("9.1 课代表任命", styles["H2"]))
    story.append(Paragraph("在「课代表任命」标签页中，可为每个科目指定一名或多名学生担任课代表。权限限定在被分配科目内，候选人来自「账号管理」中角色设为「课代表」的用户。", styles["Body"]))
    story.append(Paragraph("9.2 账号管理", styles["H2"]))
    story.append(Paragraph("管理员可在此：重置任意用户密码；将学生账号升级为课代表（需绑定负责科目）；按角色筛选查看所有账号。注意：超级管理员（superadmin）角色不可修改。", styles["Body"]))
    story.append(Paragraph("9.3 操作日志", styles["H2"]))
    story.append(Paragraph("系统完整记录所有数据变更操作，包括操作人、操作类型（新增 / 修改 / 删除）、涉及数据表、修改前后数据快照，可用于审计追溯与数据恢复参考。", styles["Body"]))

    # ==================== 十、移动端 ====================
    story += section("十、", "移动端适配")
    story.append(Paragraph("系统完全支持手机与平板访问，具有以下特性：", styles["Body"]))
    story.append(Paragraph("• <b>响应式布局</b>：侧边栏在小屏变为抽屉式菜单，点击左上角汉堡图标展开", styles["BodyBullet"]))
    story.append(Paragraph("• <b>安全区域适配</b>：自动处理刘海屏与底部指示器安全距离", styles["BodyBullet"]))
    story.append(Paragraph("• <b>触摸优化</b>：按钮与表格行增大点击区域，方便手指操作", styles["BodyBullet"]))
    story.append(Paragraph("• <b>横屏兼容</b>：平板横屏时充分利用屏幕空间", styles["BodyBullet"]))
    story.append(Spacer(1, 2 * mm))
    story.append(callout(Paragraph("推荐使用浏览器直接访问系统地址，添加到主屏可获得类似原生 App 的体验。", styles["TipText"])))

    # ==================== 十一、FAQ ====================
    story += section("十一、", "常见问题（FAQ）")
    faqs = [
        ("Q：忘记管理员密码怎么办？", "A：使用 superadmin 账号（密码 Feiyue@2026）登录，在「系统设置 → 账号管理」中重置 admin 密码。"),
        ("Q：如何添加新科目？", "A：数据库初始化时已预置初中全科 13 门科目 +「其他」。如需额外科目，请联系管理员在数据库中添加。"),
        ("Q：学生能看到别人的成绩吗？", "A：不能。学生端只展示本人数据，无法查看其他同学信息。"),
        ("Q：学分算错了怎么办？", "A：可在「学生管理」中使用「手动调分」功能修正，并填写原因备查。"),
        ("Q：如何备份数据？", "A：系统所有数据存储在 server/data/credit.db 文件中，定期复制此文件即可完成备份。"),
        ("Q：页面显示 APPLICATION LOADING 怎么办？", "A：这是服务冷启动正常现象（免费版约需 30 秒）。建议配置 UptimeRobot 保活服务避免休眠，详见 docs/KEEP-ALIVE.md。"),
        ("Q：如何部署到公网？", "A：项目已配置 Render Blueprint 部署，推送代码到 GitHub 即可自动上线。详见 RENDER_GUIDE.html。"),
    ]
    for q, a in faqs:
        story.append(Paragraph(q, styles["H2"]))
        story.append(Paragraph(a, styles["Body"]))

    story.append(PageBreak())

    # ==================== 附录：技术规格 ====================
    story += section("附录、", "技术规格")
    spec = [
        [Paragraph("<b>项目</b>", styles["TableHeader"]), Paragraph("<b>规格</b>", styles["TableHeader"])],
        [Paragraph("前端框架", styles["TableCell"]), Paragraph("Vue 3 + Element Plus + Vue Router + Pinia", styles["TableCell"])],
        [Paragraph("后端框架", styles["TableCell"]), Paragraph("Express 5 + node:sqlite（零依赖本地数据库）", styles["TableCell"])],
        [Paragraph("图表库", styles["TableCell"]), Paragraph("ECharts 5", styles["TableCell"])],
        [Paragraph("部署平台", styles["TableCell"]), Paragraph("Render（免费层）/ 本地 Node.js", styles["TableCell"])],
        [Paragraph("支持的科目", styles["TableCell"]), Paragraph("语文、数学、英语、物理、化学、生物、道德与法治、历史、地理、体育与健康、音乐、美术、信息科技 + 其他（自定义）", styles["TableCell"])],
        [Paragraph("任务类型", styles["TableCell"]), Paragraph("作业(HOMEWORK)、背书(BACKING)、测验(EXAM)、其他(OTHER)", styles["TableCell"])],
    ]
    story.append(mckinsey_table(spec, [40 * mm, 120 * mm]))
    story.append(Spacer(1, 12 * mm))
    story.append(hr(0.8, RULE))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("— 洛一高附中八（十）班 · 学分管理系统 —　|　斐越科技出品", styles["Closing"]))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"[pdf] Guide generated: {output_path}")


if __name__ == "__main__":
    output = os.path.join(os.path.dirname(__file__), "洛一高附中八（十）班-学分管理系统使用指南.pdf")
    build_guide(output)
