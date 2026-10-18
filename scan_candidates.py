# -*- coding: utf-8 -*-
"""扫描整个世界，找出所有大型人造建筑（带屋顶检测）"""
import sys, json, math
from collections import Counter
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks
from filter_build import TERRAIN

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

# 收集所有非地形方块，按 16x16 区域统计
region_blocks = Counter()          # (rx, rz) -> 块数
block_set = {}                     # (x,y,z) -> id
for root in chunk_iter(REGION):
    cx, cz = root.get('xPos'), root.get('zPos')
    for sec in root.get('sections', []) or []:
        sy, blocks = section_blocks(sec)
        if blocks is None: continue
        for i, (name, props) in enumerate(blocks):
            if name in ('minecraft:air',): continue
            base = name.replace('minecraft:', '')
            if base in TERRAIN: continue
            wx = cx*16 + (i & 15)
            wy = sy*16 + ((i >> 8) & 15)
            wz = cz*16 + ((i >> 4) & 15)
            block_set[(wx, wy, wz)] = base
            region_blocks[(wx//16, wz//16)] += 1

# 找稠密区域（人造方块 >= 1500 / 256 格），并聚类相邻
dense = set((rx, rz) for (rx, rz), c in region_blocks.items() if c >= 1500)

def neighbors(rx, rz):
    return [(rx+dx, rz+dz) for dx, dz in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]]

clusters = []
seen = set()
for r in dense:
    if r in seen: continue
    # BFS
    stack = [r]; comp = set(); seen.add(r)
    while stack:
        cur = stack.pop(); comp.add(cur)
        for n in neighbors(*cur):
            if n in dense and n not in seen:
                seen.add(n); stack.append(n)
    # 该聚类的方块包围盒
    xs=[x for (x,y,z) in block_set if (x//16, z//16) in comp]
    if not xs: continue
    pts = [(x,y,z) for (x,y,z) in block_set if (x//16, z//16) in comp]
    x0=min(p[0] for p in pts); x1=max(p[0] for p in pts)
    y0=min(p[1] for p in pts); y1=max(p[1] for p in pts)
    z0=min(p[2] for p in pts); z1=max(p[2] for p in pts)
    n = len(pts)
    # 屋顶检测：最高 2 层的覆盖率
    top_cov = sum(1 for p in pts if p[1] >= y1-1) / ((x1-x0+1)*(z1-z0+1)) if (x1-x0+1)*(z1-z0+1) else 0
    clusters.append({
        'x':[x0,x1], 'y':[y0,y1], 'z':[z0,z1], 'blocks': n,
        'size':(x1-x0+1, y1-y0+1, z1-z0+1), 'roof_cov': top_cov,
        'regions': len(comp),
    })

clusters.sort(key=lambda c: -c['blocks'])
print("发现 %d 个建筑群:" % len(clusters))
for i, c in enumerate(clusters):
    roof = "有屋顶" if c['roof_cov'] > 0.5 else ("部分" if c['roof_cov'] > 0.2 else "无屋顶")
    print("  #%d  x[%d..%d] y[%d..%d] z[%d..%d]  尺寸%dx%dx%d  方块%d  %s(顶覆盖%.0f%%)"
          % (i, c['x'][0], c['x'][1], c['y'][0], c['y'][1], c['z'][0], c['z'][1],
             c['size'][0], c['size'][1], c['size'][2], c['blocks'], roof, c['roof_cov']*100))
