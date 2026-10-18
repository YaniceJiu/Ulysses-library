# -*- coding: utf-8 -*-
"""扫描世界，找用户的'白+红+木板平台'建筑（在地面上）"""
import sys
from collections import Counter, defaultdict
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

# 用户建筑特征方块
WHITE = {'white_wool','white_concrete','white_stained_glass','white_terracotta','white_carpet','smooth_quartz','quartz_block'}
RED = {'red_wool','red_concrete','red_carpet','red_terracotta','red_stained_glass','red_nether_bricks','red_nether_brick_wall','bricks','red_sandstone','nether_bricks'}
WOOD = {'oak_planks','spruce_planks','dark_oak_planks','oak_log','spruce_log','dark_oak_log','oak_fence','spruce_fence','dark_oak_fence'}
BLUE = {'blue_wool','blue_carpet','blue_concrete','light_blue_wool','light_blue_carpet','water'}

# 每个 16x16 区域统计 白/红/木
stats = defaultdict(lambda: Counter())
for root in chunk_iter(REGION):
    cxx, czz = root.get('xPos'), root.get('zPos')
    for sec in root.get('sections', []) or []:
        sy, sb = section_blocks(sec)
        if sb is None: continue
        for i, (name, props) in enumerate(sb):
            if name == 'minecraft:air': continue
            bid = name.replace('minecraft:', '')
            wx = cxx*16+(i&15); wz = czz*16+((i>>4)&15)
            key = (wx//16, wz//16)
            if bid in WHITE: stats[key]['white'] += 1
            elif bid in RED: stats[key]['red'] += 1
            elif bid in WOOD: stats[key]['wood'] += 1
            elif bid in BLUE: stats[key]['blue'] += 1

# 找同时有白+红+木的区域（用户的建筑）
print("同时有 白+红+木 的 16x16 区域 (可能是用户建筑):")
cands = []
for key, c in stats.items():
    if c['white'] >= 100 and c['red'] >= 50 and c['wood'] >= 50:
        cands.append((key, c['white'], c['red'], c['wood'], c['blue']))
cands.sort(key=lambda t: -(t[1]+t[2]+t[3]))
for key, w, r, wo, bl in cands[:15]:
    print("  区域(%3d,%3d) 世界中心(%4d,%4d)  白%d 红%d 木%d 蓝%d" % (key[0], key[1], key[0]*16+8, key[1]*16+8, w, r, wo, bl))
if not cands:
    print("  (没有找到匹配的)")
