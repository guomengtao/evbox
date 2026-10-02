#!/usr/bin/env python3
"""截图核查工具：联络表 + 坐标标尺。

用法:
  python3 shot_tools.py sheet <out.png> <a.png> <b.png> ...   # 横排拼图（带文件名标签）
  python3 shot_tools.py ruler <in.png> <out.png>             # 叠加 y 坐标标尺（每 20px 一线，每 40px 标数）
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/Helvetica.ttc',
]

def font(sz):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def sheet(out, files):
    imgs = []
    for f in files:
        im = Image.open(f).convert('RGB')
        imgs.append((os.path.basename(f).replace('.png', ''), im))
    pad, label_h = 8, 16
    w = sum(im.width for _, im in imgs) + pad * (len(imgs) + 1)
    h = max(im.height for _, im in imgs) + pad * 2 + label_h
    canvas = Image.new('RGB', (w, h), (24, 24, 28))
    d = ImageDraw.Draw(canvas)
    f = font(11)
    x = pad
    for name, im in imgs:
        canvas.paste(im, (x, pad + label_h))
        d.text((x + 1, pad + 2), name, fill=(255, 220, 120), font=f)
        d.rectangle([x, pad + label_h, x + im.width, pad + label_h + im.height], outline=(90, 90, 100))
        x += im.width + pad
    canvas.save(out)
    print(f'[sheet] {out}  {canvas.width}x{canvas.height}  ({len(imgs)} 张)')


def ruler(src, out):
    im = Image.open(src).convert('RGB')
    canvas = im.copy()
    d = ImageDraw.Draw(canvas)
    f = font(10)
    for y in range(0, im.height, 20):
        long = (y % 40 == 0)
        color = (255, 60, 60) if long else (255, 255, 0, 90)
        d.line([(0, y), (im.width, y)], fill=color, width=1)
        if long and y > 0:
            d.rectangle([0, y - 11, 22, y - 1], fill=(255, 60, 60))
            d.text((2, y - 11), str(y), fill=(255, 255, 255), font=f)
    canvas.save(out)
    print(f'[ruler] {out}  {canvas.width}x{canvas.height}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'sheet':
        sheet(sys.argv[2], sys.argv[3:])
    elif cmd == 'ruler':
        ruler(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(1)
