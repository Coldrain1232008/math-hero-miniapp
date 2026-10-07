#!/usr/bin/env python3
# tools/gen-share-cover.py
# 生成小程序分享封面图（5:4，微信推荐比例），用于「转发给好友」与「分享到朋友圈」卡片。
# 改了标题文案后重跑：python3 tools/gen-share-cover.py
#
# 说明：本图走代码包本地路径（/images/share-cover.png），好友分享一定可见。
#      朋友圈卡片若未显示自定义图（部分机型要求 HTTPS 直链），
#      把这张图上传到云存储，再把 utils/share.js 里的 SHARE_IMAGE 换成云存储链接即可。

import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

S = 2  # 超采样倍数，画完再缩，边缘更干净
W, H = 800 * S, 640 * S
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'miniprogram', 'images', 'share-cover.png')

# Hiragino Sans GB.ttc: index 0 = W3 常规, 1 = W6 粗体
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'


def font(size, index=1):
    return ImageFont.truetype(FONT, size * S, index=index)


def star_pts(cx, cy, r, ir):
    """四角星：4 个外尖 + 4 个内凹"""
    pts = []
    for i in range(4):
        a_out = math.radians(-90 + i * 90)
        a_in = math.radians(-45 + i * 90)
        pts.append((cx + r * math.cos(a_out), cy + r * math.sin(a_out)))
        pts.append((cx + ir * math.cos(a_in), cy + ir * math.sin(a_in)))
    return pts


img = Image.new('RGB', (W, H))
d = ImageDraw.Draw(img)

# ---- 背景：纵向渐变 #1a1a2e -> #332b6e ----
c1, c2 = (0x1a, 0x1a, 0x2e), (0x33, 0x2b, 0x6e)
for y in range(H):
    t = y / (H - 1)
    d.line(
        [(0, y), (W, y)],
        fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)),
    )

# ---- 背景星点 ----
random.seed(7)
for _ in range(70):
    x, y = random.randint(0, W), random.randint(0, H)
    r = random.choice([1, 1, 1, 2]) * S
    a = random.choice([38, 54, 72])
    d.ellipse([x - r, y - r, x + r, y + r], fill=(a, a, int(a * 1.7)))

# ---- 徽章：双环 + 中心四角星（呼应登录页 emblem）----
cx, cy = W // 2, 150 * S
d.ellipse([cx - 58 * S, cy - 58 * S, cx + 58 * S, cy + 58 * S],
          outline=(0x6c, 0x63, 0xff), width=3 * S)
d.ellipse([cx - 44 * S, cy - 44 * S, cx + 44 * S, cy + 44 * S],
          outline=(0x8b, 0x83, 0xff), width=2 * S)
d.polygon(star_pts(cx, cy, 24 * S, 9 * S), fill=(0xd8, 0xd4, 0xff))

# ---- 主标题 ----
d.text((W // 2, 290 * S), '学业英雄养成记', font=font(58),
       fill=(0xff, 0xff, 0xff), anchor='mm')

# ---- 分隔线 + 菱形 ----
ly = 348 * S
half = 148 * S
d.line([(W // 2 - half, ly), (W // 2 - 22 * S, ly)],
       fill=(0x5a, 0x54, 0xa8), width=int(1.5 * S))
d.line([(W // 2 + 22 * S, ly), (W // 2 + half, ly)],
       fill=(0x5a, 0x54, 0xa8), width=int(1.5 * S))
d.polygon(star_pts(W // 2, ly, 7 * S, 2.5 * S), fill=(0x8b, 0x83, 0xff))

# ---- 副标题 ----
d.text((W // 2, 405 * S), '淬炼心智 · 铸就传奇', font=font(28),
       fill=(0xb8, 0xb3, 0xe8), anchor='mm')

# ---- 底部说明 ----
d.text((W // 2, 552 * S), '把每一次进步，变成看得见的成长', font=font(21, 0),
       fill=(0x86, 0x80, 0xc0), anchor='mm')

out = img.resize((800, 640), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, optimize=True)
print('saved:', OUT)
print('size :', out.size)
print('bytes:', os.path.getsize(OUT))
