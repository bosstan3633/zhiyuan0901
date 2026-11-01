#!/usr/bin/env python3
"""
宣传片叠加层渲染（字幕 / 品牌尾帧 / 紫色主线母题）

为什么用 PIL 而非 ffmpeg 的 drawtext/subtitles：
  本机 ffmpeg 9.0.2 是 `--enable-gpl` 的 homebrew 构建，**没有 libass / libfreetype**
  （实测 `ffmpeg -filters | grep -E 'subtitles|drawtext'` 无命中）。
  所以字幕不能靠 ffmpeg 烧录，只能先渲染成 PNG 再用 overlay 贴上去。
  PIL 12.2 + 系统中文字体（PingFang SC / Hiragino Sans GB）可用，已实测。

时间轴依据（实测语音时长反推，母本镜头1/2/3 边界不变，仅 4/5 边界微调）：
  镜头1 00:00-00:10  v1 6.20s  @1.20  → 7.40
  镜头2 00:10-00:20  v2 9.00s  @10.30 → 19.30
  镜头3 00:20-00:35  v3 13.90s @20.40 → 34.30
  镜头4 00:35-00:46  v4 9.20s  @35.40 → 44.60
  镜头5 00:46-01:00  v5 12.70s @46.50 → 59.20
"""
import os
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'work', 'overlays')
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080
BRAND_PURPLE = (109, 92, 232)      # #6D5CE8 品牌紫（底稿 §5.3）
AMBER = (185, 106, 32)             # #B96A20 好奇点琥珀

# —— 中文字体（macOS 自带） ——
def font(size, weight='regular'):
    paths = {
        'regular': '/System/Library/Fonts/PingFang.ttc',
        'bold': '/System/Library/Fonts/PingFang.ttc',
    }
    p = paths[weight]
    try:
        return ImageFont.truetype(p, size, index=0 if weight == 'regular' else 2)
    except Exception:
        return ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', size, index=0)

def text_width(draw, s, f):
    return draw.textbbox((0, 0), s, font=f)[2]

# ─────────────────────────────────────────────────────────────
# ① 字幕：按句切分，时间与配音对齐
# ─────────────────────────────────────────────────────────────
# 字幕文案逐字取自母本旁白全稿，不改写、不增删信息点。
SUBS = [
    # (起, 止, 文本, 类型)  类型：normal=对白字幕 / caption=品类说明条 / brand=品牌字幕条
    (1.20,  4.20, '世界不断上新，工具越攒越多。', 'normal'),
    (4.20,  7.40, '但你要推进的那件事——走到哪了？', 'normal'),
    (10.30, 12.60, '知源调度台——', 'normal'),
    (12.60, 16.00, '你在浏览器里的个人调度中台。', 'caption'),
    (16.00, 19.30, '收录到知源、留下好奇、随时调出，都只要几秒。', 'normal'),
    (20.40, 24.60, '每天打开新标签页，先看见今天最重要的三件事——', 'normal'),
    (24.60, 28.20, '它们挂在哪个项目、指向哪个目标，一目了然。', 'normal'),
    (28.20, 34.30, '需要的资料和工具，直接调用到任务里，不必事事从零开始。', 'normal'),
    (35.40, 39.20, '做过的事，别只留在记录里。', 'normal'),
    (39.20, 44.60, '在策展台，围绕主题取舍、分层，让判断有论据、让观点有支撑——策展成你自己的表达。', 'normal'),
    (46.50, 49.60, '你的数据 100% 存在本地，无需账号，随时导出。', 'normal'),
    (49.60, 51.60, '看见方向，留下好奇，调用所需，策展成果。', 'caption'),
    (51.60, 55.40, '知源调度台：万千可调用，自有我方向。', 'caption'),
    (55.40, 59.20, '带着一件正在推进的事，进入知源。', 'caption'),
]

def render_subtitle(idx, text, kind):
    """渲染单条字幕为透明 PNG（1920×1080，overlay 用）"""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if kind == 'caption':
        size, col, y = 46, (255, 255, 255, 245), 852
    else:
        size, col, y = 50, (255, 255, 255, 250), 862

    f = font(size, 'bold' if kind == 'caption' else 'regular')
    tw = text_width(d, text, f)
    x = (W - tw) // 2

    if kind == 'caption':
        # 品类/品牌说明句用半透明深色衬底条，读得清但不抢画面
        pad_x, pad_y = 34, 16
        box = Image.new('RGBA', (tw + pad_x * 2, size + pad_y * 2 + 10), (13, 14, 17, 170))
        bd = ImageDraw.Draw(box)
        bd.rounded_rectangle([0, 0, box.width - 1, box.height - 1], radius=10,
                             fill=(13, 14, 17, 170), outline=BRAND_PURPLE + (110,), width=1)
        img.alpha_composite(box, (x - pad_x, y - pad_y))
    else:
        # 对白字幕：柔和暗色渐变衬底 + 轻投影，任何底色上都可读
        grad = Image.new('RGBA', (W, 150), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for i in range(150):
            a = int(155 * (1 - abs(i - 75) / 75) ** 1.6)
            gd.line([(0, i), (W, i)], fill=(0, 0, 0, a))
        img.alpha_composite(grad, (0, y - 34))
        shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.text((x + 2, y + 3), text, font=f, fill=(0, 0, 0, 190))
        img.alpha_composite(shadow)
        d = ImageDraw.Draw(img)

    d.text((x, y), text, font=f, fill=col)
    p = os.path.join(OUT, f'sub_{idx:02d}.png')
    img.save(p)
    return p

# ─────────────────────────────────────────────────────────────
# ② 品牌尾帧：Logo + 主 Slogan + 品类句 + CTA
# ─────────────────────────────────────────────────────────────
def render_endframe():
    img = Image.new('RGB', (W, H), (13, 14, 17))
    d = ImageDraw.Draw(img)

    # 底部紫色主线（视觉母题收束）
    for i in range(3):
        a = 90 - i * 26
        d.rectangle([0, H - 7 + i * 2, W, H - 6 + i * 2], fill=BRAND_PURPLE + (a,))

    # Logo
    icon = '/Users/beantan/Downloads/zhiyuan0904/v2/public/icons/icon128.png'
    try:
        lg = Image.open(icon).convert('RGBA').resize((96, 96), Image.LANCZOS)
        img.paste(lg, ((W - 96) // 2, 330), lg)
    except Exception as e:
        print('  ! logo 读取失败：', e)

    f_brand = font(58, 'bold')
    f_slogan = font(76, 'bold')
    f_cat = font(40)
    f_cta = font(36)

    def center(y, s, f, fill):
        d.text(((W - text_width(d, s, f)) // 2, y), s, font=f, fill=fill)

    # 母本尾帧字幕条：「知源 Ownway ｜ 万千可调用，自有我方向 ｜ 免费使用 · 本地安装」
    # 「带着一件正在推进的事，进入知源」是**旁白末句**，由字幕轨承担，
    # 不在尾帧画面里重复排一次（否则两行叠在一起出重影）。
    center(452, '知源 Ownway', f_brand, (150, 152, 170))
    center(530, '万千可调用，自有我方向', f_slogan, (255, 255, 255))
    center(642, '你在浏览器里的个人调度中台', f_cat, (168, 170, 188))
    center(726, '免费使用 · 本地安装', f_cta, (150, 140, 245))

    p = os.path.join(OUT, 'endframe.png')
    img.save(p)
    return p

# ─────────────────────────────────────────────────────────────
# ③ 紫色主线母题：贯穿全片的发光线（overlay，带 alpha）
# ─────────────────────────────────────────────────────────────
def render_thread():
    """一条自左下向右上的连续紫色光带 —— 母本「外部万千，内有主线」的视觉母题。

    第一版用一串离散圆点画线，结果在成片里像一条"珠链"，与母本要求的
    「一条连续的深空薰衣草紫主线」不符，也谈不上 Linear 式克制。
    这一版改成：先在低分辨率画一条真正的连续细线 → 放大 → 高斯模糊做光晕，
    再叠一条清晰的细线本体，得到"细线 + 柔光"的连续光带。
    压在画面底部，不遮挡 UI 主体。
    """
    from PIL import ImageFilter

    SS = 2  # 超采样倍率，先小图画再放大，线条更平滑

    def path_y(x):
        t = max(0.0, x / W)
        # 贴底走线：母本要求主线贯穿全片，但**不能横穿 UI 内容区**
        # （第一版走在 y≈930，横切真实界面像一道划痕，已下移到画面底缘）。
        return H - 26 + 16 * (t ** 1.6)

    # —— 光晕层（小图 → 放大 → 模糊） ——
    glow = Image.new('RGBA', (W // SS, H // SS), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    pts = [(x // SS, int(path_y(x) // SS)) for x in range(0, W + 8, 8)]
    gd.line(pts, fill=(109, 92, 232, 150), width=3, joint='curve')
    glow = glow.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(7))

    # —— 线条本体 ——
    # 注意：pts 是**超采样小图坐标**（画布 W//SS × H//SS），光线本体画在全尺寸画布上，
    # 必须另用全尺寸坐标，否则线会缩在左上角半区（实测成了横切画面的短紫线）。
    line = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    pts_full = [(x, int(path_y(x))) for x in range(0, W + 8, 8)]
    for i in range(len(pts_full) - 1):
        x0, y0 = pts_full[i]
        x1, y1 = pts_full[i + 1]
        # 亮度沿程渐变：起点弱、中后段最亮（节点逐渐接入）
        t = x0 / float(W)
        a = int(95 + 130 * min(1.0, max(0.0, (t - 0.12) / 0.6)))
        col = (int(min(255, 109 + 55 * t)), int(min(255, 92 + 55 * t)), 255, int(a))
        ld.line([(x0, y0), (x1, y1)], fill=col, width=3)
    # 节点：沿线等距的小光点，呼应"沿途节点接入信息"
    for k in range(1, 6):
        x = int(W * (0.14 + 0.155 * k))
        y = path_y(x)
        r = 4
        ld.ellipse([x - r, y - r, x + r, y + r], fill=(214, 206, 255, 205))

    img = Image.alpha_composite(glow, line)
    p = os.path.join(OUT, 'thread.png')
    img.save(p)
    return p

# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    manifest = []
    for i, (s, e, text, kind) in enumerate(SUBS):
        p = render_subtitle(i, text, kind)
        manifest.append({'start': s, 'end': e, 'text': text, 'kind': kind, 'png': os.path.basename(p)})
        print(f'  字幕{i:02d} [{s:5.1f}-{e:5.1f}] {text[:26]}… ({kind})')

    ef = render_endframe()
    th = render_thread()
    manifest.append({'endframe': os.path.basename(ef), 'thread': os.path.basename(th)})

    mp = os.path.join(OUT, 'overlay_manifest.json')
    with open(mp, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'\n✅ 叠加层已渲染 → {OUT}')
