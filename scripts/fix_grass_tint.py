# -*- coding: utf-8 -*-
"""
把 Mineways 导出的"生物群系染色"橙红植被纹理改成正常绿色。
原理：Minecraft 植被纹理是"染色图"，本世界群系给草地/树叶染成橙红(高R低G)，
把 R/G 通道互换即得绿色。草方块侧面是"泥土+草条"混合，只处理橙红植被像素。
"""
from PIL import Image
import os, sys

def swap_rg(im):
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y][0], px[x, y][1], px[x, y][2], px[x, y][3] if len(px[x, y]) == 4 else 255
            px[x, y] = (g, r, b, a if len(im.getbands()) == 4 else None) if len(im.getbands()) == 4 else (g, r, b)
    return im

def fix(file):
    im = Image.open(file)
    rgba = im.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # 植被染色像素特征：R明显高于G，且G高于B（橙）；正常泥土R/G/B较接近
            if r - g > 60 and g - b > 40:
                px[x, y] = (g, r, b, a)  # 换R/G → 绿
    # 纯植被纹理整体换
    out = rgba.convert('RGB') if im.mode != 'RGBA' else rgba
    out.save(file)
    return True

def full_swap(file):
    im = Image.open(file).convert('RGB')
    r, g, b = im.split()
    out = Image.merge('RGB', (g, r, b))
    out.save(file)

ROOTS = [r'C:\Users\janic\Downloads\mc_walkthrough\tex',
         r'C:\Users\janic\Downloads\mc_walkthrough\public\tex']

FULL_SWAP = ['grass_block_top_y.png', 'oak_leaves_y.png', 'short_grass_y.png']
PARTIAL = ['grass_block_side_y.png']  # 泥土+草条混合，只改橙红像素

for root in ROOTS:
    if not os.path.isdir(root):
        continue
    for name in FULL_SWAP:
        p = os.path.join(root, name)
        if os.path.exists(p):
            full_swap(p)
            print('整体换R/G:', p)
    for name in PARTIAL:
        p = os.path.join(root, name)
        if os.path.exists(p):
            fix(p)
            print('部分改绿:', p)

# 验证
im = Image.open(r'C:\Users\janic\Downloads\mc_walkthrough\public\tex\grass_block_top_y.png').convert('RGB')
px = list(im.getdata()); n = len(px)
avg = tuple(sum(c[i] for c in px)//n for i in range(3))
print('修复后 grass_block_top 平均色:', avg)
