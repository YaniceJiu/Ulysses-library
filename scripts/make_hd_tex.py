# -*- coding: utf-8 -*-
"""
把 16x16 的 Mineways 贴图高清化（16 -> 64，4x），输出到 public/tex_hd/。
方法：LANCZOS 放大 + UnsharpMask 锐化（边缘清晰、内部平滑），读取时用 LinearFilter 平滑显示。

用法：
  python make_hd_tex.py grass_block_top_y.png oak_planks.png      # 只做指定几张
  python make_hd_tex.py all                                       # 全部
"""
from PIL import Image, ImageFilter
import os, sys

SRC = r'C:\Users\janic\Downloads\mc_walkthrough\public\tex'
DST = r'C:\Users\janic\Downloads\mc_walkthrough\public\tex_hd'
SCALE = 4            # 16 -> 64
TARGET = 64
SHARPEN = True       # 锐化让边缘更清晰

def make_hd(name):
    src = os.path.join(SRC, name)
    if not os.path.exists(src):
        print('  跳过（不存在）:', name)
        return False
    im = Image.open(src).convert('RGBA')
    im = im.resize((TARGET, TARGET), Image.LANCZOS)
    if SHARPEN:
        im = im.filter(ImageFilter.UnsharpMask(radius=3, percent=200, threshold=2))
    os.makedirs(DST, exist_ok=True)
    im.save(os.path.join(DST, name))
    return True

def main():
    names = sys.argv[1:]
    if len(names) == 1 and names[0].lower() == 'all':
        names = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
    if not names:
        print('用法: python make_hd_tex.py <name...|all>')
        return
    ok = 0
    for n in names:
        if make_hd(n):
            ok += 1
            print('  HD:', n)
    print('完成 %d/%d' % (ok, len(names)))

if __name__ == '__main__':
    main()
