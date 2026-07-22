# -*- coding: utf-8 -*-
# 洛一高附中八（十）班 · 学分管理系统 使用指南 —— 精装重制版
# 设计：封面/封底 canvas 手绘 + 内页 platypus + matplotlib 图解 + Noto Sans SC 字体
import os, shutil
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, Image, KeepTogether, ListFlowable, ListItem)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import Rectangle, FancyBboxPatch, Polygon, Circle, FancyArrowPatch
import matplotlib.patheffects as pe
from PIL import Image as PILImage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "洛一高附中八（十）班-学分管理系统使用指南.pdf")
LOGO = os.path.join(HERE, "frontend", "public", "logo.jpg")
TMP = os.path.join(HERE, "_pdf_tmp")
os.makedirs(TMP, exist_ok=True)

# ---------------- 字体 ----------------
NOTO = "C:/Windows/Fonts/NotoSansSC-VF.ttf"
HEI  = "C:/Windows/Fonts/STXIHEI.TTF"
pdfmetrics.registerFont(TTFont("NotoSC", NOTO))
pdfmetrics.registerFont(TTFont("NotoSC-B", HEI))
pdfmetrics.registerFontFamily("NotoSC", normal="NotoSC", bold="NotoSC-B",
                             italic="NotoSC", boldItalic="NotoSC-B")
fm.fontManager.addfont(NOTO)
FONTPROP = fm.FontProperties(fname=NOTO)
FONTNAME = FONTPROP.get_name()
plt.rcParams.update({
    "font.family": FONTNAME, "font.size": 11, "font.weight": "bold",
    "axes.edgecolor": "#9AA5B1", "axes.linewidth": 0.8,
    "figure.dpi": 200, "savefig.dpi": 200, "axes.unicode_minus": False,
    "font.sans-serif": [FONTNAME], "svg.fonttype": "none",
})

# ---------------- 配色 ----------------
NAVY   = colors.HexColor("#0B2545")
NAVY2  = colors.HexColor("#13315C")
BLUE   = colors.HexColor("#2E6FAC")
RED    = colors.HexColor("#C8102E")
GOLD   = colors.HexColor("#C8A24B")
INK    = colors.HexColor("#1F2933")
GRAY   = colors.HexColor("#5B6770")
LIGHT  = colors.HexColor("#F4F6F9")
RULE   = colors.HexColor("#D5DBE2")
GREEN  = colors.HexColor("#2F8F5B")
AMBER  = colors.HexColor("#E0A100")
WHITE  = colors.white
C_NAVY="#0B2545"; C_BLUE="#2E6FAC"; C_RED="#C8102E"; C_GRAY="#9AA5B1"
C_LIGHT="#E8ECF1"; C_GREEN="#2F8F5B"; C_AMBER="#E0A100"; C_INK="#1F2933"

CONTENT_W = 160 * mm
PW, PH = A4

# ============================================================
#  图解生成（matplotlib）
# ============================================================
def _save(fig, name):
    p = os.path.join(TMP, name)
    fig.savefig(p, bbox_inches="tight", facecolor="white", pad_inches=0.05)
    plt.close(fig)
    with PILImage.open(p) as im:
        w, h = im.size
    return p, w / h

def diag_architecture():
    fig = plt.figure(figsize=(9.2, 4.4))
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis("off")
    ax.set_xlim(0, 10); ax.set_ylim(0, 10)
    def box(x, y, w, h, t, sub=None, fc=C_BLUE, tc="white", fs=11):
        ax.add_patch(FancyBboxPatch((x-w/2, y-h/2), w, h,
                     boxstyle="round,pad=0.05,rounding_size=0.18",
                     fc=fc, ec="none"))
        ax.text(x, y+(0.30 if sub else 0), t, ha="center", va="center",
                color=tc, fontsize=fs, fontweight="bold", fontproperties=FONTPROP)
        if sub:
            ax.text(x, y-0.30, sub, ha="center", va="center", color=tc,
                    fontsize=8.5, fontproperties=FONTPROP, alpha=0.9)
    def arrow(x1,y1,x2,y2,c=C_GRAY):
        ax.add_patch(FancyArrowPatch((x1,y1),(x2,y2), arrowstyle="-|>",
                     mutation_scale=14, lw=1.6, color=c,
                     connectionstyle="arc3,rad=0.0"))
    # 用户层
    users=[("班主任",C_NAVY),("教师",C_NAVY),("课代表",C_NAVY),("学生",C_NAVY)]
    for i,(t,c) in enumerate(users):
        box(1.25+i*2.5, 8.4, 2.1, 1.1, t, fc=c)
    # 应用层
    box(3.0, 5.4, 3.6, 1.5, "前端应用", "Vue 3 + Element Plus", fc=C_BLUE)
    box(7.0, 5.4, 3.6, 1.5, "后端服务", "Express 5 + node:sqlite", fc=C_BLUE)
    # 数据层
    box(5.0, 2.2, 4.2, 1.4, "数据层", "SQLite 本地数据库 · 零依赖", fc=C_NAVY)
    # 连线
    for i in range(4):
        arrow(1.25+i*2.5, 7.85, 5.0, 6.15)
    arrow(3.0, 4.65, 5.0, 2.9)
    arrow(7.0, 4.65, 5.0, 2.9)
    # 标签
    ax.text(5.0, 9.55, "用户层 · 四类角色", ha="center", color=C_GRAY, fontsize=9.5, fontproperties=FONTPROP)
    ax.text(5.0, 6.55, "应用层", ha="center", color=C_GRAY, fontsize=9.5, fontproperties=FONTPROP)
    return _save(fig, "arch.png")

def diag_matrix():
    rows = ["管理员","教师","课代表","学生"]
    cols = ["数据看板","任务管理","完成登记","学生管理","手动调分","账号管理","预警中心","学生端"]
    # 1=允许, 0=禁止
    M = {
      "管理员":[1,1,1,1,1,1,1,1],
      "教师":  [1,1,1,1,1,0,1,1],
      "课代表":[1,1,1,0,0,0,1,1],
      "学生":  [1,0,0,0,0,0,0,1],
    }
    fig = plt.figure(figsize=(9.6, 4.3))
    ax = fig.add_axes([0,0,1,1]); ax.axis("off")
    ax.set_xlim(0, len(cols)+1); ax.set_ylim(0, len(rows)+1.4)
    cw=1.0; ch=0.92
    # 列标题（旋转）
    for j,c in enumerate(cols):
        ax.text(j+1.5, len(rows)+0.9, c, ha="left", va="center",
                rotation=42, fontsize=10, color=C_INK, fontproperties=FONTPROP)
    # 行标题
    for i,r in enumerate(rows):
        y = len(rows)-i-0.5+0.5
        ax.add_patch(FancyBboxPatch((0.15, y-ch/2), 1.15, ch,
                     boxstyle="round,pad=0.02,rounding_size=0.12",
                     fc=C_NAVY, ec="none"))
        ax.text(0.725, y, r, ha="center", va="center", color="white",
                fontsize=10.5, fontweight="bold", fontproperties=FONTPROP)
    # 单元格
    for i,r in enumerate(rows):
        y = len(rows)-i-0.5+0.5
        for j in range(len(cols)):
            x = j+1.5
            ok = M[r][j]
            fc = C_GREEN if ok else C_LIGHT
            ax.add_patch(FancyBboxPatch((x-cw/2+0.06, y-ch/2), cw-0.12, ch,
                         boxstyle="round,pad=0.02,rounding_size=0.14",
                         fc=fc, ec="white", lw=1.5))
            ax.text(x, y, "✓" if ok else "×", ha="center", va="center",
                    color="white" if ok else C_GRAY, fontsize=14,
                    fontweight="bold", fontproperties=FONTPROP)
    ax.text(0.15, len(rows)+1.15, "角色权限矩阵（✓ 允许　× 禁止）",
            fontsize=11, color=C_INK, fontproperties=FONTPROP, fontweight="bold")
    return _save(fig, "matrix.png")

def diag_flow():
    fig = plt.figure(figsize=(9.0, 5.0))
    ax = fig.add_axes([0,0,1,1]); ax.axis("off")
    ax.set_xlim(0,10); ax.set_ylim(0,10)
    def box(x,y,w,h,t,sub=None,fc=C_BLUE,tc="white"):
        ax.add_patch(FancyBboxPatch((x-w/2,y-h/2),w,h,
                     boxstyle="round,pad=0.04,rounding_size=0.18",fc=fc,ec="none"))
        ax.text(x,y+(0.18 if sub else 0),t,ha="center",va="center",color=tc,
                fontsize=11.5,fontweight="bold",fontproperties=FONTPROP)
        if sub:
            ax.text(x,y-0.34,sub,ha="center",va="center",color=tc,fontsize=9,
                    fontproperties=FONTPROP,alpha=0.92)
    def arr(x1,y1,x2,y2,c=C_GRAY):
        ax.add_patch(FancyArrowPatch((x1,y1),(x2,y2),arrowstyle="-|>",
                     mutation_scale=15,lw=1.7,color=c))
    box(5,8.6,3.4,1.2,"发布任务","教师 / 课代表创建")
    arr(5,8.0,5,7.0)
    box(5,6.4,3.4,1.2,"学生完成提交","系统在截止时间判定")
    arr(5,5.8,2.2,4.6,C_GREEN); arr(5,5.8,5,4.6,C_AMBER); arr(5,5.8,7.8,4.6,C_RED)
    box(2.2,4.0,2.7,1.7,"按时完成","截止前提交\n+100%",C_GREEN)
    box(5.0,4.0,2.7,1.7,"逾期完成","截止后提交\n+50%",C_AMBER)
    box(7.8,4.0,2.7,1.7,"未完成","未提交\n0 分",C_RED)
    arr(2.2,3.25,5,2.2); arr(5,3.25,5,2.2); arr(7.8,3.25,5,2.2)
    box(5,1.5,4.2,1.1,"计入学分流水","生成可审计的记录",fc=C_NAVY)
    ax.text(5,9.7,"学分计算流程",ha="center",fontsize=12,color=C_INK,
            fontweight="bold",fontproperties=FONTPROP)
    return _save(fig, "flow.png")

def diag_dashboard():
    fig = plt.figure(figsize=(9.4, 5.4))
    # 各科目完成率（横向条形）
    ax1 = fig.add_axes([0.30, 0.57, 0.40, 0.36])
    subs=["语文","数学","英语","物理","化学","历史","地理"]
    vals=[94,88,96,82,85,91,79]
    y=range(len(subs))
    ax1.barh(list(y), vals, color=C_BLUE, height=0.62)
    ax1.set_yticks(list(y)); ax1.set_yticklabels(subs, fontproperties=FONTPROP, fontsize=9)
    ax1.set_xlim(0,100); ax1.set_xticks([0,50,100])
    ax1.tick_params(labelsize=8)
    for i,v in enumerate(vals):
        ax1.text(v+1.5,i,f"{v}%",va="center",fontsize=8,color=C_INK,fontproperties=FONTPROP)
    ax1.set_title("各科目完成率", fontproperties=FONTPROP, fontsize=11, color=C_INK, loc="left", weight="bold")
    ax1.spines[["top","right"]].set_visible(False)
    # 完成状态分布（环形）
    ax2 = fig.add_axes([0.72, 0.57, 0.26, 0.36])
    svals=[60,15,18,7]; slabels=["按时","逾期","未完成","未通过"]
    scolors=[C_GREEN,C_AMBER,C_RED,C_GRAY]
    ax2.pie(svals, colors=scolors, startangle=90, counterclock=False,
            wedgeprops=dict(width=0.42, edgecolor="white", linewidth=1.5))
    ax2.text(0,0,"完成\n状态",ha="center",va="center",fontsize=9,color=C_INK,fontproperties=FONTPROP)
    ax2.legend(slabels, loc="lower center", bbox_to_anchor=(0.5,-0.18),
               ncol=2, fontsize=7.5, frameon=False, prop=FONTPROP)
    ax2.set_title("完成状态分布", fontproperties=FONTPROP, fontsize=11, color=C_INK, loc="center", weight="bold")
    # 学分趋势（折线）
    ax3 = fig.add_axes([0.10, 0.10, 0.82, 0.34])
    import numpy as np
    wk=np.arange(1,9)
    s1=[20,38,55,70,88,102,121,140]
    s2=[18,30,48,60,75,90,105,118]
    s3=[22,40,52,68,80,95,110,130]
    ax3.plot(wk,s1,marker="o",color=C_BLUE,lw=2,label="张三")
    ax3.plot(wk,s2,marker="s",color=C_GREEN,lw=2,label="李四")
    ax3.plot(wk,s3,marker="^",color=C_RED,lw=2,label="王五")
    ax3.set_xticks(wk); ax3.set_xlabel("周次", fontproperties=FONTPROP, fontsize=9)
    ax3.set_ylabel("累计学分", fontproperties=FONTPROP, fontsize=9)
    ax3.legend(loc="upper left", fontsize=8, frameon=False, prop=FONTPROP)
    ax3.grid(axis="y", color=C_LIGHT, lw=1)
    ax3.spines[["top","right"]].set_visible(False)
    ax3.set_title("学生学分积累趋势", fontproperties=FONTPROP, fontsize=11, color=C_INK, loc="left", weight="bold")
    return _save(fig, "dash.png")

# ============================================================
#  封面 / 封底（canvas 手绘）
# ============================================================
def draw_cover(path):
    c = canvas.Canvas(path, pagesize=A4)
    W, H = PW, PH
    # 背景
    c.setFillColor(WHITE); c.rect(0,0,W,H,fill=1,stroke=0)
    # 右上装饰同心圆
    c.setStrokeAlpha(0.07); c.setStrokeColor(NAVY); c.setLineWidth(1)
    for r in [55,72,90]:
        c.circle(W-28*mm, H-34*mm, r*mm)
    c.setStrokeAlpha(1)
    # 左上标签
    c.setFillColor(RED); c.rect(20*mm, H-30*mm, 3*mm, 12*mm, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont("NotoSC-B", 10.5)
    c.drawString(25.5*mm, H-27.2*mm, "使用指南")
    c.setFillColor(GRAY); c.setFont("NotoSC", 9)
    c.drawString(25.5*mm, H-31.5*mm, "USER  GUIDE")
    # Logo 框
    ls = 60*mm
    lx = (W-ls)/2; ly = H*0.585
    c.setFillColor(WHITE); c.roundRect(lx, ly, ls, ls, 10*mm, fill=1, stroke=1)
    c.setStrokeColor(NAVY); c.setLineWidth(1.4); c.roundRect(lx, ly, ls, ls, 10*mm, fill=0, stroke=1)
    pad = 9*mm
    c.drawImage(LOGO, lx+pad, ly+pad, ls-2*pad, ls-2*pad,
                preserveAspectRatio=True, anchor="c", mask="auto")
    # 标题
    c.setFillColor(NAVY); c.setFont("NotoSC-B", 30)
    c.drawCentredString(W/2, H*0.455, "洛一高附中八（十）班")
    c.setFillColor(GRAY); c.setFont("NotoSC-B", 15)
    c.drawCentredString(W/2, H*0.405, "班级作业学分管理系统")
    # 红色强调线
    c.setFillColor(RED); c.rect(W/2-22*mm, H*0.365, 44*mm, 1.6*mm, fill=1, stroke=0)
    # 副标题
    c.setFillColor(BLUE); c.setFont("NotoSC-B", 13)
    c.drawCentredString(W/2, H*0.335, "使 用 指 南  ·  USER  GUIDE")
    # 底部色带
    c.setFillColor(NAVY); c.rect(0, 0, W, 20*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("NotoSC-B", 11)
    c.drawString(20*mm, 7.8*mm, "斐越科技  出品")
    c.setFont("NotoSC", 9.5); c.setFillColor(C_GRAY)
    c.drawRightString(W-20*mm, 7.8*mm, "V2.1   ·   2026.07")
    c.showPage(); c.save()

def draw_back(path):
    c = canvas.Canvas(path, pagesize=A4)
    W, H = PW, PH
    c.setFillColor(NAVY); c.rect(0,0,W,H,fill=1,stroke=0)
    # 左下装饰圆
    c.setStrokeAlpha(0.10); c.setStrokeColor(WHITE); c.setLineWidth(1)
    for r in [40,58,76]:
        c.circle(18*mm, 30*mm, r*mm)
    c.setStrokeAlpha(1)
    # 中心白圆 + logo
    R=30*mm; cx=W/2; cy=H*0.62
    c.setFillColor(WHITE); c.circle(cx, cy, R, fill=1, stroke=0)
    pad=7*mm
    c.drawImage(LOGO, cx-R+pad, cy-R+pad, 2*(R-pad), 2*(R-pad),
                preserveAspectRatio=True, anchor="c", mask="auto")
    # 文字
    c.setFillColor(WHITE); c.setFont("NotoSC-B", 22)
    c.drawCentredString(cx, cy-R-16*mm, "斐越科技  出品")
    c.setFillColor(C_GRAY); c.setFont("NotoSC", 12)
    c.drawCentredString(cx, cy-R-24*mm, "洛一高附中八（十）班 · 班级作业学分管理系统")
    c.setFillColor(RED); c.rect(cx-18*mm, cy-R-31*mm, 36*mm, 1.4*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("NotoSC-B", 13)
    c.drawCentredString(cx, cy-R-40*mm, "感谢使用，让班级管理更高效")
    # 底部
    c.setFillColor(C_GRAY); c.setFont("NotoSC", 9)
    c.drawCentredString(cx, 26*mm, "© 2026 斐越科技　保留所有权利")
    c.drawCentredString(cx, 19*mm, "本手册仅供班级内部使用")
    c.showPage(); c.save()

# ============================================================
#  内页样式
# ============================================================
def styles():
    s = {}
    s["body"]  = ParagraphStyle("body", fontName="NotoSC", fontSize=10, leading=17.5,
                                textColor=INK, spaceBefore=1, spaceAfter=7, alignment=4)
    s["h2"]    = ParagraphStyle("h2", fontName="NotoSC-B", fontSize=12.5, leading=18,
                                textColor=BLUE, spaceBefore=13, spaceAfter=5)
    s["num"]   = ParagraphStyle("num", fontName="NotoSC-B", fontSize=20, leading=22,
                                textColor=WHITE, alignment=1)
    s["ch"]    = ParagraphStyle("ch", fontName="NotoSC-B", fontSize=17, leading=21,
                                textColor=NAVY, alignment=0)
    s["th"]    = ParagraphStyle("th", fontName="NotoSC-B", fontSize=9.5, leading=13,
                                textColor=WHITE, alignment=1)
    s["td"]    = ParagraphStyle("td", fontName="NotoSC", fontSize=9.5, leading=13.5,
                                textColor=INK)
    s["tdc"]   = ParagraphStyle("tdc", fontName="NotoSC", fontSize=9.5, leading=13.5,
                                textColor=INK, alignment=1)
    s["tip"]   = ParagraphStyle("tip", fontName="NotoSC", fontSize=9.5, leading=15,
                                textColor=INK, leftIndent=3)
    s["cap"]   = ParagraphStyle("cap", fontName="NotoSC", fontSize=8.5, leading=12,
                                textColor=GRAY, alignment=1, spaceBefore=2, spaceAfter=8)
    s["tocn"]  = ParagraphStyle("tocn", fontName="NotoSC-B", fontSize=12, leading=18,
                                textColor=RED, alignment=1, rightIndent=4)
    s["toct"]  = ParagraphStyle("toct", fontName="NotoSC-B", fontSize=12, leading=18,
                                textColor=NAVY)
    s["tocd"]  = ParagraphStyle("tocd", fontName="NotoSC", fontSize=9.5, leading=18,
                                textColor=GRAY)
    s["ft"]    = ParagraphStyle("ft", fontName="NotoSC", fontSize=8, leading=12,
                                textColor=GRAY)
    return s

S = styles()

def hr(t=0.8, col=RULE, w=CONTENT_W):
    t0 = Table([[""]], colWidths=[w], rowHeights=[t])
    t0.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),col),
                            ("LINEBEFORE",(0,0),(-1,-1),0,WHITE),
                            ("LINEAFTER",(0,0),(-1,-1),0,WHITE)]))
    return t0

def chapter(num, title):
    nc = Table([[Paragraph(num, S["num"])]], colWidths=[15*mm], rowHeights=[15*mm])
    nc.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),
                            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                            ("ALIGN",(0,0),(-1,-1),"CENTER"),
                            ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    out = Table([[nc, Paragraph(title, S["ch"])]],
                colWidths=[15*mm, CONTENT_W-15*mm-5*mm])
    out.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                             ("LEFTPADDING",(1,0),(1,0),5*mm),
                             ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    flow=[out, Spacer(1,2*mm), hr(1.3, NAVY), Spacer(1,4*mm)]
    return flow

def callout(text):
    inner = Table([[Paragraph(text, S["tip"])]], colWidths=[CONTENT_W])
    inner.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),LIGHT),
                               ("LINEBEFORE",(0,0),(0,-1),3,RED),
                               ("LEFTPADDING",(0,0),(-1,-1),11),
                               ("RIGHTPADDING",(0,0),(-1,-1),11),
                               ("TOPPADDING",(0,0),(-1,-1),8),
                               ("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    return inner

def mtable(data, widths, aligns=None):
    t = Table(data, colWidths=widths, repeatRows=1)
    st=[("FONTNAME",(0,0),(-1,-1),"NotoSC"),("FONTSIZE",(0,0),(-1,-1),9.5),
        ("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),WHITE),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("LINEBELOW",(0,0),(-1,-1),0.5,RULE),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,LIGHT]),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7)]
    if aligns:
        for i,a in enumerate(aligns):
            st.append(("ALIGN",(i,0),(i,-1),a))
    t.setStyle(TableStyle(st))
    return t

def img(path, aspect, caption=None):
    h = CONTENT_W/aspect
    flow=[Image(path, width=CONTENT_W, height=h)]
    if caption:
        flow.append(Paragraph(caption, S["cap"]))
    return KeepTogether(flow)

# ============================================================
#  构建内页
# ============================================================
def build_body(path, diags):
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=25*mm, rightMargin=25*mm,
                            topMargin=22*mm, bottomMargin=20*mm,
                            title="洛一高附中八（十）班 学分管理系统 使用指南",
                            author="斐越科技")
    story=[]

    # ---- 目录 ----
    story += chapter("00", "目录 · CONTENTS")
    toc=[("01","系统概述","功能定位、核心价值与系统架构"),
         ("02","账号与登录","默认账号、角色权限矩阵与安全说明"),
         ("03","数据看板","总览、图表分析与趋势洞察"),
         ("04","任务管理","创建任务、自定义项与模板"),
         ("05","完成登记","记录学生任务完成状态"),
         ("06","学生管理","档案维护、手动调分与导出"),
         ("07","学生端","查看个人学分 · 提交作业附件"),
         ("08","预警中心","连续未完成与即将截止提醒"),
         ("09","系统设置","科目、课代表、账号、存储与日志"),
         ("10","移动端适配","手机 / 平板访问说明"),
         ("11","常见问题","登录、查分、提交作业等场景答疑")]
    for n,t,d in toc:
        row=Table([[Paragraph(n,S["tocn"]),Paragraph(t,S["toct"]),Paragraph(d,S["tocd"])]],
                  colWidths=[14*mm,42*mm,CONTENT_W-56*mm])
        row.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                                 ("BOTTOMPADDING",(0,0),(-1,-1),6),
                                 ("TOPPADDING",(0,0),(-1,-1),4),
                                 ("LINEBELOW",(0,0),(-1,-1),0.4,RULE)]))
        story.append(row)
    story.append(PageBreak())

    # ---- 01 系统概述 ----
    story += chapter("01", "系统概述")
    story.append(Paragraph("1.1　什么是学分管理系统", S["h2"]))
    story.append(Paragraph(
        "洛一高附中八（十）班学分管理系统，是一套专为初中班级设计的作业管理与学分量化工具。"
        "系统将日常学习任务（作业、背书、测验等）转化为可追踪的学分记录，帮助班主任与科任教师"
        "全面掌握每一位学生的学习状态，实现精细化、数据化的班级管理。本系统由<b>斐越科技</b>开发。", S["body"]))
    story.append(img(diags["arch"], diags["arch_a"],
                     "图 1　系统总体架构：用户层 → 应用层 → 数据层，前后端分离、本地零依赖数据库"))
    story.append(Paragraph("1.2　核心功能模块", S["h2"]))
    func=[[Paragraph("模块",S["th"]),Paragraph("功能描述",S["th"]),Paragraph("适用角色",S["th"])],
          [Paragraph("数据看板",S["td"]),Paragraph("班级总览、各科目完成率、学分趋势",S["td"]),Paragraph("全部",S["tdc"])],
          [Paragraph("任务管理",S["td"]),Paragraph("新建 / 编辑任务、模板、自定义项",S["td"]),Paragraph("老师 / 课代",S["tdc"])],
          [Paragraph("完成登记",S["td"]),Paragraph("批量登记完成状态（按时 / 逾期 / 未通过）",S["td"]),Paragraph("老师 / 课代",S["tdc"])],
          [Paragraph("学生管理",S["td"]),Paragraph("学生档案、手动调分、导出报表",S["td"]),Paragraph("老师 / 课代",S["tdc"])],
          [Paragraph("学生端",S["td"]),Paragraph("查看个人学分明细与历史流水",S["td"]),Paragraph("全部",S["tdc"])],
          [Paragraph("预警中心",S["td"]),Paragraph("连续未完成、即将截止自动预警",S["td"]),Paragraph("老师 / 课代",S["tdc"])],
          [Paragraph("系统设置",S["td"]),Paragraph("科目、课代表、账号、操作日志",S["td"]),Paragraph("老师 / 管理员",S["tdc"])]]
    story.append(mtable(func,[34*mm,86*mm,40*mm],["CENTER","LEFT","CENTER"]))
    story.append(PageBreak())

    # ---- 02 账号与登录 ----
    story += chapter("02", "账号与登录")
    story.append(Paragraph("2.1　默认账号", S["h2"]))
    acct=[[Paragraph("用户名",S["th"]),Paragraph("角色",S["th"]),Paragraph("密码",S["th"]),Paragraph("说明",S["th"])],
          [Paragraph("admin",S["td"]),Paragraph("管理员",S["td"]),Paragraph("123456",S["tdc"]),Paragraph("最高权限，可管理所有设置",S["td"])],
          [Paragraph("teacher01",S["td"]),Paragraph("教师",S["td"]),Paragraph("123456",S["tdc"]),Paragraph("主科任教师，可管理所有科目",S["td"])],
          [Paragraph("rep01 / rep02",S["td"]),Paragraph("课代表",S["td"]),Paragraph("123456",S["tdc"]),Paragraph("仅可管理所负责的科目",S["td"])],
          [Paragraph("student01~student06",S["td"]),Paragraph("学生",S["td"]),Paragraph("123456",S["tdc"]),Paragraph("查看个人学分，不可操作他人",S["td"])],
          [Paragraph("superadmin",S["td"]),Paragraph("超级管理员",S["td"]),Paragraph("Feiyue@2026",S["tdc"]),Paragraph("开发者账号，拥有所有权限",S["td"])]]
    story.append(mtable(acct,[30*mm,30*mm,28*mm,72*mm],["CENTER","CENTER","CENTER","LEFT"]))
    story.append(Spacer(1,3*mm))
    story.append(callout("⚠ 安全提示：首次使用后请立即修改默认密码，避免账号被他人登录。"))
    story.append(Paragraph("2.2　角色权限矩阵", S["h2"]))
    story.append(Paragraph("系统采用基于角色的访问控制（RBAC）。下表清晰呈现四类角色在八大功能上的权限分布：", S["body"]))
    story.append(img(diags["matrix"], diags["matrix_a"],
                     "图 2　角色权限矩阵：管理员拥有全部权限；教师可管理教学数据但不可管理账号；课代表仅限本科目；学生仅可查看本人数据"))
    story.append(PageBreak())

    # ---- 03 数据看板 ----
    story += chapter("03", "数据看板")
    story.append(Paragraph("进入系统后首先看到的是<b>数据看板</b>，以图表直观呈现班级整体学情。", S["body"]))
    story.append(img(diags["dash"], diags["dash_a"],
                     "图 3　数据看板示意：左上为各科目完成率对比，右上为任务完成状态分布，下方为三位学生的学分积累趋势"))
    story.append(Paragraph("3.1　统计卡片", S["h2"]))
    story.append(Paragraph("顶部三张卡片实时展示<b>在读学生人数</b>、<b>本学期任务数</b>、<b>平均学分</b>，对班级整体状况一目了然。", S["body"]))
    story.append(Paragraph("3.2　图表分析", S["h2"]))
    story.append(Paragraph("• <b>各科目完成率（条形）</b>：横向对比各科完成率，点击可下钻查看该科目每个任务详情。", S["body"]))
    story.append(Paragraph("• <b>完成状态分布（环形）</b>：按时 / 逾期 / 未完成 / 未通过四种状态占比。", S["body"]))
    story.append(Paragraph("• <b>学分积累趋势（折线）</b>：选择任意学生，查看其学分随时间的增长曲线。", S["body"]))
    story.append(PageBreak())

    # ---- 04 任务管理 ----
    story += chapter("04", "任务管理")
    story.append(Paragraph("4.1　新建任务", S["h2"]))
    story.append(Paragraph("点击「+ 新建任务」，填写：标题、科目、类型、学分、截止时间、说明。", S["body"]))
    story.append(Paragraph("• <b>科目</b>：语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 道法 / 历史 / 地理 / 体育 / 音乐 / 美术 / 信息科技 / 其他", S["body"]))
    story.append(Paragraph("• <b>类型</b>：作业 / 背书 / 测验 / 其他", S["body"]))
    story.append(Paragraph("4.2　其他项（自定义任务）", S["h2"]))
    story.append(Paragraph("除固定学科外，系统提供<b>「其他」</b>选项创建非学科类任务。选择「其他」后会出现<b>「自定义类别」</b>输入框，可输入任意类别，如：劳动实践、班级事务、行为规范、竞赛获奖等。", S["body"]))
    story.append(callout("自定义类别名称会保存在任务说明中，方便后续筛选与识别。"))
    story.append(Paragraph("4.3　学分计算规则", S["h2"]))
    story.append(img(diags["flow"], diags["flow_a"],
                     "图 4　学分计算流程：系统依据截止时间自动判定完成状态，并对应不同的学分比例"))
    rule=[[Paragraph("完成状态",S["th"]),Paragraph("获得学分",S["th"]),Paragraph("说明",S["th"])],
          [Paragraph("按时完成",S["td"]),Paragraph("100%",S["tdc"]),Paragraph("截止日期前提交，获全额学分",S["td"])],
          [Paragraph("逾期完成",S["td"]),Paragraph("50%",S["tdc"]),Paragraph("超期后完成，按半额计分",S["td"])],
          [Paragraph("未完成",S["td"]),Paragraph("0 分",S["tdc"]),Paragraph("未在规定时间完成，不计学分",S["td"])],
          [Paragraph("未通过",S["td"]),Paragraph("0 分",S["tdc"]),Paragraph("完成但质量不达标，需重做",S["td"])]]
    story.append(mtable(rule,[34*mm,34*mm,92*mm],["CENTER","CENTER","LEFT"]))
    story.append(PageBreak())

    # ---- 05 完成登记 ----
    story += chapter("05", "完成登记")
    story.append(Paragraph("在「完成登记」页，教师或课代表可批量记录学生任务完成状态。选择任务后，系统列出全班学生，可为每人标记：按时完成 / 逾期完成 / 未完成 / 未通过。保存后系统自动计算每位学生应得学分，并生成学分流水记录。", S["body"]))
    # ---- 06 学生管理 ----
    story += chapter("06", "学生管理")
    story.append(Paragraph("「学生管理」页展示全班学生档案（姓名、学号、当前总学分），可在此：", S["body"]))
    story.append(Paragraph("• <b>手动调分</b>：非任务类变动（奖励、惩罚、补录）使用「手动调整学分」，输入增减分数与原因，生成对应流水。", S["body"]))
    story.append(Paragraph("• <b>导出报表</b>：将学分数据导出为 CSV，便于在 Excel 中分析或上报。", S["body"]))
    # ---- 07 学生端 ----
    story += chapter("07", "学生端")
    story.append(Paragraph("7.1　查看个人学分", S["h2"]))
    story.append(Paragraph("学生登录后进入「学生端」，可查看：", S["body"]))
    story.append(Paragraph("• 个人基本信息（姓名、学号、当前总学分）", S["body"]))
    story.append(Paragraph("• 所有任务完成状态一览", S["body"]))
    story.append(Paragraph("• 学分流水明细（来源任务、变动金额、类型、时间）", S["body"]))
    story.append(callout("学生仅能查看本人数据，无法修改学分或查看他人成绩，保证数据公正性。"))
    story.append(Paragraph("7.2　提交作业与附件", S["h2"]))
    story.append(Paragraph("学生在「提交作业」页选择任务后上传附件并提交。系统按截止时间自动判定<b>按时 / 逾期</b>并计分，无需老师手动录入。", S["body"]))
    story.append(Paragraph("• <b>支持任意格式</b>：图片（JPG/PNG/HEIC）、视频（MP4/MOV）、Word、Excel、PDF 等均可上传，单文件上限 300MB。", S["body"]))
    story.append(Paragraph("• <b>提交要求</b>：每次提交至少附带 1 个附件；上传过程显示进度与压缩前后体积。", S["body"]))
    story.append(Paragraph("7.3　智能压缩（保清晰度）", S["h2"]))
    story.append(Paragraph("为节省流量与存储，系统在上传时自动压缩附件体积，<b>且不牺牲清晰度</b>：", S["body"]))
    comp=[[Paragraph("<b>类型</b>",S["th"]),Paragraph("<b>压缩方式</b>",S["th"]),Paragraph("<b>清晰度</b>",S["th"])],
          [Paragraph("图片",S["td"]),Paragraph("保留原分辨率，高质量重编码（q92），仅超 4096px 才缩放",S["td"]),Paragraph("肉眼无损",S["tdc"])],
          [Paragraph("视频",S["td"]),Paragraph("H.264 重编码（CRF23），分辨率、帧率完全不变",S["td"]),Paragraph("视觉无损",S["tdc"])],
          [Paragraph("PDF / 文档",S["td"]),Paragraph("对象流重整 + 无损打包，下载时自动还原",S["td"]),Paragraph("完全无损",S["tdc"])]]
    story.append(mtable(comp,[26*mm,104*mm,30*mm],["CENTER","LEFT","CENTER"]))
    story.append(callout("典型效果：手机照片体积降 60–80%，视频降 30–60%，画质几乎无差别；下载得到的文件可正常打开、清晰如初。"))
    story.append(Paragraph("7.4　处理进度提示", S["h2"]))
    story.append(Paragraph("为方便学生清晰掌握上传状态，每个附件在提交时都会显示<b>两段实时进度</b>：", S["body"]))
    story.append(Paragraph("• <b>上传中 X%</b>：文件字节上传进度，随网络实时变化。", S["body"]))
    story.append(Paragraph("• <b>处理中 …</b>：服务端自动压缩 / 转码阶段。视频会显示<b>真实百分比</b>（如「视频转码中… 45%」），图片、PDF、文档处理极快，以转圈动画提示「处理中…」，完成后转为「已上传」。", S["body"]))
    story.append(callout("提示：图片、PDF 压缩通常在瞬间完成，进度条一闪而过属正常现象；真正需要等待的是视频转码（免费版算力有限，较长视频可能需 1–3 分钟），此时进度条会平滑推进至 100% 后再标记完成。"))
    # ---- 08 预警中心 ----
    story += chapter("08", "预警中心")
    story.append(Paragraph("系统自动监测学习状态，产生两类预警：", S["body"]))
    story.append(Paragraph("• <b>DANGER（危险级）</b>：某学生连续多个任务未完成，需重点关注、及时干预。", S["body"]))
    story.append(Paragraph("• <b>WARN（警告级）</b>：某任务即将到期但仍有学生未完成。可单个或「一键提醒」批量发送。", S["body"]))
    # ---- 09 系统设置 ----
    story += chapter("09", "系统设置")
    story.append(Paragraph("9.1　课代表任命", S["h2"]))
    story.append(Paragraph("可为每个科目指定一名或多名学生担任课代表，权限限定在被分配科目内，候选人来自「账号管理」中角色设为「课代表」的用户。", S["body"]))
    story.append(Paragraph("9.2　账号管理", S["h2"]))
    story.append(Paragraph("管理员可重置任意用户密码；将学生升级为课代表（绑定科目）；按角色筛选查看。注意：超级管理员角色不可修改。", S["body"]))
    story.append(Paragraph("9.3　操作日志", S["h2"]))
    story.append(Paragraph("系统完整记录所有数据变更（操作人、类型、数据表、前后快照），可用于审计追溯与数据恢复参考。", S["body"]))
    # ---- 10 移动端 ----
    story += chapter("10", "移动端适配")
    story.append(Paragraph("系统完全支持手机与平板访问：", S["body"]))
    story.append(Paragraph("• <b>响应式布局</b>：小屏侧边栏变为抽屉式菜单", S["body"]))
    story.append(Paragraph("• <b>安全区域适配</b>：自动处理刘海屏与底部指示器距离", S["body"]))
    story.append(Paragraph("• <b>触摸优化</b>：按钮与表格行增大点击区域", S["body"]))
    story.append(callout("推荐用浏览器直接访问，添加到主屏可获得类似原生 App 的体验。"))
    # ---- 11 FAQ ----
    story += chapter("11", "常见问题（FAQ）")
    faqs=[
          # —— 登录与入口 ——
          ("怎么登录系统？手机能用吗？","用手机或电脑浏览器打开系统网址即可登录。手机访问时把网页「添加到主屏」，就能像 App 一样从桌面点开使用。账号密码由老师/管理员发放。"),
          ("忘记学生端账号或密码了怎么办？","请找本班课代表或老师，由管理员在「系统设置 → 账号管理」里重置密码；学生本人无法自行找回，请勿反复试错导致账号锁定。"),
          # —— 查分 ——
          ("在哪里能看到自己的学分？","登录后进入「学生端」，页面顶部显示当前总学分，下方有「学分流水明细」，可查看每笔学分的来源任务、变动金额和时间。"),
          ("哪些作业还没做，从哪里看？","在「学生端」的任务列表里，未完成的任务会标注状态（如绿色「待完成」/ 红色「已逾期」），一眼就能看出还差哪些。"),
          ("我的学分算少了 / 算错了怎么办？","先核对「学分流水明细」确认是哪一笔。若确有差错，联系老师，由老师在「学生管理」中用「手动调分」修正并填写原因备查。"),
          # —— 提交作业 ——
          ("怎么提交作业？","进入「提交作业」页 → 选择对应任务 → 点击上传附件（图片 / 视频 / Word / PDF 均可）→ 等待处理完成 → 点击「提交」。每次提交至少需要 1 个附件。"),
          ("上传附件都支持哪些格式？","几乎支持任意格式：手机照片（JPG/PNG/HEIC）、视频（MP4/MOV）、音频（MP3/M4A/WAV/录音等）、Word、Excel、PDF 等都可以，单个文件最大 300MB。"),
          ("上传的音频（朗读/录音）会压缩吗？","会。音频（如 WAV/FLAC 等无损大文件）会自动转成 AAC 格式，体积可降 80% 左右，听感几乎无差别；已是 MP3 的也尽量在不损失听感的前提下压小，方便上传和下载。"),
          ("用手机拍的作业照片怎么交？","在「提交作业」页直接点「选择文件」选中手机相册里的照片即可，系统会自动压缩体积（画质不变），不用自己先处理。"),
          ("上传后进度条一直在转 / 不动，正常吗？","正常。图片、PDF 压缩通常在瞬间完成，进度条一闪而过；只有「视频」转码较慢（免费版算力有限，较长视频可能需 1–3 分钟），此时进度条会显示真实百分比并平滑走到 100%，请耐心等待不要关闭页面。"),
          ("文件太大传不上去怎么办？","系统会自动压缩以减小体积：图片保留清晰度、视频做视觉无损瘦身。若仍超限，可先在手机上对视频做简单剪辑/压缩，或分段上传后再合并说明。"),
          ("传错了附件 / 提交错了能改吗？","可以。在「我的提交」里删除错误的附件或整条提交，重新上传正确的文件即可；提交前也可逐个移除待上传项。"),
          ("作业逾期了还能提交吗？","可以提交，但系统会按截止时间自动标记为「逾期」并相应计分（逾期通常不加分或加分较少），建议尽量按时完成。"),
          ("提交之后老师要审核吗？学分什么时候到账？","不需要老师手动确认。系统按任务截止时间自动判定「按时 / 逾期」并计分，提交成功即生效，刷新「学生端」即可看到学分变化。"),
          # —— 清晰度与保存 ——
          ("附件压缩后作业会不会变模糊？","不会。图片保留原分辨率仅优化编码、视频按视觉无损重编码、PDF 与文档为完全无损，下载后清晰度与原件一致。"),
          ("上传的作业能一直保存吗？","当前为临时存储（约 1GB，可容纳约 1000–3000 份压缩后附件），重新部署或服务器维护后会清空，通常可保存数天到数周。重要作业请及时下载留存；如需长期保存可接入对象存储。"),
          # —— 家长关心 ——
          ("家长能直接查看孩子的学分和作业吗？","系统账号以「学生本人」为单位，家长可让孩子用其账号在自己手机上登录查看；学分与作业仅本人和老师可见，确保数据私密。"),
          ("附件和成绩会不会泄露隐私？","不会。学生只能看到自己的数据，无法查看他人；附件下载受权限控制，仅本人与老师可访问。"),
          # —— 其他 ——
          ("如何添加课本里没有的科目 / 任务？","科目已预置初中全科 13 门 +「其他」；老师可在「任务管理」里用「其他」自建自定义任务（如手抄报、体育锻炼）。如需新增固定科目，联系管理员处理。")]
    for q,a in faqs:
        story.append(Paragraph(q, S["h2"]))
        story.append(Paragraph(a, S["body"]))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE); canvas.setLineWidth(0.5)
        canvas.line(25*mm, 15*mm, 185*mm, 15*mm)
        canvas.setFont("NotoSC", 7.8); canvas.setFillColor(GRAY)
        canvas.drawString(25*mm, 11*mm, "洛一高附中八（十）班 · 学分管理系统")
        canvas.drawCentredString(105*mm, 11*mm, "斐越科技 出品")
        canvas.drawRightString(185*mm, 11*mm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print("[pdf] body done")

# ============================================================
#  主流程
# ============================================================
def main():
    arch, arch_a = diag_architecture()
    matrix, matrix_a = diag_matrix()
    flow, flow_a = diag_flow()
    dash, dash_a = diag_dashboard()
    diags={"arch":arch,"arch_a":arch_a,"matrix":matrix,"matrix_a":matrix_a,
           "flow":flow,"flow_a":flow_a,"dash":dash,"dash_a":dash_a}
    cover=os.path.join(TMP,"cover.pdf"); back=os.path.join(TMP,"back.pdf"); body=os.path.join(TMP,"body.pdf")
    draw_cover(cover); draw_back(back); build_body(body, diags)
    import fitz
    final=fitz.open()
    for p in (cover, body, back):
        final.insert_pdf(fitz.open(p))
    final.save(OUT)
    final.close()
    print(f"[pdf] merged -> {OUT}")
    # 清理
    shutil.rmtree(TMP, ignore_errors=True)
    print("[pdf] temp cleaned")

if __name__=="__main__":
    main()
