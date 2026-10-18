# -*- coding: utf-8 -*-
"""检查所有世界在用户坐标附近的建筑"""
import os, sys, glob
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks
from collections import Counter

base = r"C:\Users\janic\AppData\Roaming\.minecraft\saves"
X0, X1, Z0, Z1 = -60, -20, -60, -20
Y0, Y1 = -70, 30

for world in ['Arnis World 1', 'Arnis World 2', 'New World']:
    rdir = os.path.join(base, world, 'dimensions', 'minecraft', 'overworld', 'region')
    if not os.path.isdir(rdir):
        rdir = os.path.join(base, world, 'region')
    if not os.path.isdir(rdir):
        print("==== %s: 无region" % world); continue
    cnt = 0
    types = Counter()
    for root in chunk_iter(rdir):
        cx, cz = root.get('xPos'), root.get('zPos')
        if cx*16+15 < X0 or cx*16 > X1 or cz*16+15 < Z0 or cz*16 > Z1: continue
        for sec in root.get('sections', []) or []:
            sy, sb = section_blocks(sec)
            if sb is None: continue
            for i, (name, props) in enumerate(sb):
                if name == 'minecraft:air': continue
                wx = cx*16+(i&15); wy = sy*16+((i>>8)&15); wz = cz*16+((i>>4)&15)
                if X0 <= wx <= X1 and Z0 <= wz <= Z1 and Y0 <= wy <= Y1:
                    cnt += 1
                    types[name.replace('minecraft:', '')] += 1
    print("==== %s 在用户坐标附近非空气方块: %d 种 %d 个" % (world, len(types), cnt))
    for k, v in types.most_common(10):
        print("      %-28s %d" % (k, v))
