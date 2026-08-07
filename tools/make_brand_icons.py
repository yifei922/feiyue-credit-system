# -*- coding: utf-8 -*-
"""
斐越学分 · 小程序图标品牌化处理
- 输入：assets/mp-icons-v2 下 AI 生成的 6 张原始图标
- 输出：assets/mp-icons-v2/final 下
    * XX_头像版.png     纯图形，用于小程序头像（微信会缩到 144x144）
    * XX_带字版.png     图形 + "斐越学分"，用于启动页/宣传图/首页 Logo
    * XX_横版.png       左图右字，用于公众号头图 / 网页 Logo
- 中文用 PIL + 微软雅黑粗体精确绘制，绝不出现 AI 汉字变形
"""
import os
import glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'mp-icons-v2')
OUT = os.path.join(SRC, 'final')
os.makedirs(OUT, exist_ok=True)

FONT_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'   # 微软雅黑 Bold
TEXT = '斐越学分'
SUB = 'FEIYUE CREDIT'

# 时间戳片段 -> (序号_名称, 说明)
MAP = [
    ('05-03-36', '1_FY字母', 'FY 艺术字 + 星'),
    ('05-04-10', '2_猫头鹰', '猫头鹰戴学士帽'),
    ('05-04-42', '3_小鹿', '小鹿跃起'),
    ('05-05-22', '4_小兔', '小兔举星星'),
    ('05-05-53', '5_熊猫', '熊猫抱书'),
    ('05-06-29', '6_小狐狸FY', '小狐狸 + FY 字母'),
]


def rounded_mask(size, radius_ratio=0.22):
    w, h = size
    r = int(min(w, h) * radius_ratio)
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


def pick_bg(img):
    """取顶边/左边中点像素作为主题底色（避开圆角外的白边）"""
    w, h = img.size
    pts = [(w // 2, int(h * 0.02)), (int(w * 0.02), h // 2),
           (w // 2, int(h * 0.98)), (int(w * 0.98), h // 2)]
    cols = [img.getpixel(p) for p in pts]
    # 过滤掉接近纯白的取样点（圆角外露）
    cols = [c for c in cols if not (c[0] > 240 and c[1] > 240 and c[2] > 240)]
    if not cols:
        return (124, 92, 255)  # 兜底：极光紫 #7C5CFF
    r = sum(c[0] for c in cols) // len(cols)
    g = sum(c[1] for c in cols) // len(cols)
    b = sum(c[2] for c in cols) // len(cols)
    return (r, g, b)


def draw_text_tracked(draw, text, font, cx, y, fill, tracking=0):
    """带字间距的居中绘制，返回总宽度"""
    widths = []
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=font)
        widths.append(bb[2] - bb[0])
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        bb = draw.textbbox((0, 0), ch, font=font)
        draw.text((x - bb[0], y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def make_avatar(src_img, size=1024):
    """头像版：统一尺寸 + 干净圆角，底色补齐"""
    bg = pick_bg(src_img)
    canvas = Image.new('RGB', (size, size), bg)
    img = src_img.resize((size, size), Image.LANCZOS)
    canvas.paste(img, (0, 0), rounded_mask((size, size)))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), rounded_mask((size, size)))
    return out


def make_branded(src_img, size=1024):
    """带字版：图形上移缩小，底部写「斐越学分」"""
    bg = pick_bg(src_img)
    canvas = Image.new('RGB', (size, size), bg)

    art = int(size * 0.74)                       # 图形区
    img = src_img.resize((art, art), Image.LANCZOS)
    ax = (size - art) // 2
    ay = int(size * 0.035)
    canvas.paste(img, (ax, ay), rounded_mask((art, art)))

    d = ImageDraw.Draw(canvas)
    f_main = ImageFont.truetype(FONT_BOLD, int(size * 0.135))
    f_sub = ImageFont.truetype(FONT_BOLD, int(size * 0.042))

    draw_text_tracked(d, TEXT, f_main, size / 2, int(size * 0.775),
                      (255, 255, 255), tracking=int(size * 0.018))
    draw_text_tracked(d, SUB, f_sub, size / 2, int(size * 0.925),
                      (255, 255, 255, 200), tracking=int(size * 0.010))

    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), rounded_mask((size, size)))
    return out


def make_horizontal(src_img, w=1400, h=460):
    """横版：左图右字，用于网页 Logo / 公众号头图"""
    bg = pick_bg(src_img)
    canvas = Image.new('RGB', (w, h), bg)

    art = int(h * 0.74)
    img = src_img.resize((art, art), Image.LANCZOS)
    ax = int(h * 0.16)
    ay = (h - art) // 2
    canvas.paste(img, (ax, ay), rounded_mask((art, art)))

    d = ImageDraw.Draw(canvas)
    f_main = ImageFont.truetype(FONT_BOLD, int(h * 0.30))
    f_sub = ImageFont.truetype(FONT_BOLD, int(h * 0.095))
    tx = ax + art + int(h * 0.20)
    d.text((tx, int(h * 0.24)), TEXT, font=f_main, fill=(255, 255, 255))
    d.text((tx + 4, int(h * 0.635)), SUB, font=f_sub, fill=(255, 255, 255))

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), rounded_mask((w, h), radius_ratio=0.10))
    return out


def main():
    made = []
    for stamp, name, desc in MAP:
        hits = glob.glob(os.path.join(SRC, f'*{stamp}*.png'))
        if not hits:
            print(f'[跳过] 未找到 {stamp} ({desc})')
            continue
        src = Image.open(hits[0]).convert('RGB')

        p_av = os.path.join(OUT, f'{name}_头像版.png')
        p_br = os.path.join(OUT, f'{name}_带字版.png')
        p_hz = os.path.join(OUT, f'{name}_横版.png')

        make_avatar(src).save(p_av)
        make_branded(src).save(p_br)
        make_horizontal(src).save(p_hz)

        # 微信头像实际展示尺寸预览
        Image.open(p_av).resize((144, 144), Image.LANCZOS).save(
            os.path.join(OUT, f'{name}_头像144.png'))

        made.append((name, desc))
        print(f'[完成] {name}  {desc}')

    print(f'\n共处理 {len(made)} 组，输出目录: {OUT}')
    return made


if __name__ == '__main__':
    main()
