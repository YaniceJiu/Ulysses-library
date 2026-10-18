# -*- coding: utf-8 -*-
"""生成世界俯视地图（每个柱子的最高方块颜色），像 Minecraft 地图"""
import sys, json, math
from collections import defaultdict
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks
from block_colors import color_for
from PIL import Image

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

# 只取城区范围（白红建筑所在区域）放大
X0, X1, Z0, Z1 = -20, 192, -8, 152
SCALE = 2  # 每格像素

# 收集每列最高方块
top = {}
for root in chunk_iter(REGION):
    cxx, czz = root.get('xPos'), root.get('zPos')
    if cxx*16+15 < X0 or cxx*16 > X1 or czz*16+15 < Z0 or czz*16 > Z1: continue
    for sec in root.get('sections', []) or []:
        sy, sb = section_blocks(sec)
        if sb is None: continue
        for i, (name, props) in enumerate(sb):
            if name == 'minecraft:air': continue
            wx = cxx*16+(i&15); wy = sy*16+((i>>8)&15); wz = czz*16+((i>>4)&15)
            if X0 <= wx <= X1 and Z0 <= wz <= Z1:
                key = (wx, wz)
                if key not in top or wy > top[key][0]:
                    top[key] = (wy, name.replace('minecraft:', ''))

W = (X1-X0+1); H = (Z1-Z0+1)
img = Image.new('RGB', (W*SCALE, H*SCALE), (120, 170, 120))
px = img.load()
for (wx, wz), (wy, bid) in top.items():
    c = color_for(bid)
    if bid == 'grass_block': c = (105, 165, 80)
    elif bid == 'water': c = (70, 120, 220)
    elif bid == 'dirt': c = (140, 100, 68)
    elif bid == 'sand': c = (222, 210, 160)
    x0 = (wx-X0)*SCALE; y0 = (wz-Z0)*SCALE
    for dx in range(SCALE):
        for dy in range(SCALE):
            px[x0+dx, y0+dy] = c

img.save('worldmap_city.png')
print("已生成 worldmap_city.png", img.size)
