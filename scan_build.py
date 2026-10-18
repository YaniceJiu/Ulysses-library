# -*- coding: utf-8 -*-
"""诊断：找结构方块 + 定位人造建筑聚集区"""
import sys
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

from collections import Counter, defaultdict

be_ids = Counter()
struct_positions = []
manmade = {'gray_concrete','dark_oak_door','bookshelf','stone_bricks','oak_fence',
           'polished_andesite','smooth_sandstone','nether_bricks','smooth_stone',
           'gray_stained_glass','light_gray_concrete','oak_planks','dark_oak_planks',
           'spruce_planks','oak_stairs','spruce_stairs','dark_oak_stairs','glass',
           'glass_pane','lantern','torch','cobblestone','bricks','brick_stairs',
           'sandstone','chiseled_sandstone','cut_sandstone','bookshelf','chest',
           'barrel','lectern','campfire','spruce_log','dark_oak_log','oak_log',
           'carpet','white_carpet','gray_carpet'}

# 按 16x16 区域统计人造方块密度
density = Counter()
man_min = [10**9]*3; man_max = [-10**9]*3

for root in chunk_iter(REGION):
    cx, cz = root.get('xPos'), root.get('zPos')
    for be in root.get('block_entities', []) or []:
        be_ids[be.get('id')] += 1
        if be.get('id') == 'minecraft:structure_block':
            p = be.get('pos')
            if p: struct_positions.append((tuple(int(v) for v in p), be))
    for sec in root.get('sections', []) or []:
        sy, blocks = section_blocks(sec)
        if blocks is None: continue
        for i, (name, props) in enumerate(blocks):
            base = name.replace('minecraft:', '')
            if base in manmade:
                x = (cx*16 + (i & 15)) 
                z = (cz*16 + ((i >> 4) & 15))
                y = (sy*16 + ((i >> 8) & 15))
                density[(x//16, z//16)] += 1
                man_min[0]=min(man_min[0],x); man_max[0]=max(man_max[0],x)
                man_min[1]=min(man_min[1],y); man_max[1]=max(man_max[1],y)
                man_min[2]=min(man_min[2],z); man_max[2]=max(man_max[2],z)

print("方块实体 ID 统计:", dict(be_ids))
print("结构方块位置:", [(p[0], be.get('mode'), be.get('name')) for p, be in struct_positions] or "(无)")
print("人造方块包围盒: x[%d..%d] y[%d..%d] z[%d..%d]" % (man_min[0], man_max[0], man_min[1], man_max[1], man_min[2], man_max[2]))
print("\n人造方块密度最高的 16x16 区域 (区域坐标, 方块数):")
for (rx, rz), c in density.most_common(25):
    # 区域中心世界坐标
    print("  区域(%3d,%3d) 世界中心(%4d,%4d)  人造方块 %d" % (rx, rz, rx*16+8, rz*16+8, c))
