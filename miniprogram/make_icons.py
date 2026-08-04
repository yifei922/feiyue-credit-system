"""生成小程序tabBar图标 (5对 × 2状态 = 10个PNG)
- 81x81 像素 (微信推荐)
- 未选中: 灰色 #8893ad (RGB: 136, 147, 173)
- 选中: 红色 #c8102e (RGB: 200, 16, 46)
- 风格: 简洁线条 + 圆角, 单色
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "miniprogram" / "assets" / "tab"
OUT.mkdir(parents=True, exist_ok=True)

GRAY = (136, 147, 173)
RED  = (200, 16, 46)
SIZE = 81

def base():
    return Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

def save(img, name):
    img.save(OUT / name, 'PNG')
    print(f"  {name}")

# 1) 首页 home — 简笔小屋
def home(color):
    img = base()
    d = ImageDraw.Draw(img)
    # 屋顶三角
    d.polygon([(40, 14), (10, 38), (70, 38)], fill=color)
    # 屋身
    d.rectangle([18, 36, 62, 70], fill=color)
    # 门
    d.rectangle([34, 50, 46, 70], fill=(255, 255, 255, 255))
    # 窗
    d.rectangle([22, 42, 30, 50], fill=(255, 255, 255, 255))
    d.rectangle([50, 42, 58, 50], fill=(255, 255, 255, 255))
    return img

# 2) 学习 study — 书
def study(color):
    img = base()
    d = ImageDraw.Draw(img)
    # 翻开的两页书
    d.polygon([(12, 22), (40, 30), (40, 62), (12, 54)], fill=color)
    d.polygon([(68, 22), (40, 30), (40, 62), (68, 54)], fill=color)
    # 中线
    d.line([(40, 30), (40, 62)], fill=(255, 255, 255, 255), width=2)
    # 文字线
    for y in [38, 44, 50]:
        d.line([(18, y), (36, y)], fill=(255, 255, 255, 255), width=1)
        d.line([(44, y), (62, y)], fill=(255, 255, 255, 255), width=1)
    return img

# 3) 作业 tasks — 清单
def tasks(color):
    img = base()
    d = ImageDraw.Draw(img)
    # 复选框 1
    d.rectangle([14, 18, 26, 30], outline=color, width=2)
    d.line([(18, 24), (22, 28), (32, 16)], fill=color, width=2)
    d.line([(34, 20), (66, 20)], fill=color, width=2)
    # 复选框 2
    d.rectangle([14, 36, 26, 48], outline=color, width=2)
    d.rectangle([16, 38, 24, 46], fill=color)
    d.line([(34, 38), (66, 38)], fill=color, width=2)
    # 复选框 3
    d.rectangle([14, 54, 26, 66], outline=color, width=2)
    d.line([(34, 56), (66, 56)], fill=color, width=2)
    return img

# 4) 班级圈 feed — 对话气泡
def feed(color):
    img = base()
    d = ImageDraw.Draw(img)
    # 大气泡
    d.rounded_rectangle([10, 14, 60, 50], radius=8, fill=color)
    # 小气泡
    d.rounded_rectangle([22, 42, 70, 66], radius=8, fill=color)
    # 三角
    d.polygon([(20, 50), (14, 60), (26, 56)], fill=color)
    # 点点
    d.ellipse([20, 24, 26, 30], fill=(255, 255, 255, 255))
    d.ellipse([30, 24, 36, 30], fill=(255, 255, 255, 255))
    d.ellipse([40, 24, 46, 30], fill=(255, 255, 255, 255))
    d.ellipse([34, 50, 40, 56], fill=(255, 255, 255, 255))
    d.ellipse([44, 50, 50, 56], fill=(255, 255, 255, 255))
    d.ellipse([54, 50, 60, 56], fill=(255, 255, 255, 255))
    return img

# 5) 我的 me — 头像
def me(color):
    img = base()
    d = ImageDraw.Draw(img)
    # 头
    d.ellipse([28, 14, 56, 42], fill=color)
    # 身
    d.pieslice([14, 42, 70, 98], 180, 360, fill=color)
    # 裁剪成圆底
    mask = Image.new('L', (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, SIZE, SIZE], fill=255)
    result = base()
    rd = ImageDraw.Draw(result)
    rd.ellipse([0, 0, SIZE, SIZE], fill=(255, 255, 255, 0))
    # 用遮罩
    out = base()
    out.paste(img, (0, 0), mask)
    return out

ICONS = {
    'home': home,
    'study': study,
    'tasks': tasks,
    'feed': feed,
    'me': me,
}

print("生成 5 对 tabBar 图标 (81x81 PNG):")
for name, fn in ICONS.items():
    save(fn(GRAY), f"{name}.png")
    save(fn(RED), f"{name}_a.png")

print(f"\n输出目录: {OUT}")
print(f"文件数: {len(list(OUT.glob('*.png')))}")
