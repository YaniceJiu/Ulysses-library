# -*- coding: utf-8 -*-
"""用官方 anvil-parser 独立解析世界，与手写解析器结果逐块对比"""
import os, sys, glob, re, json
import anvil

REGION_DIR = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"
X0, X1 = -112, -6
Z0, Z1 = -64, 34
Y0, Y1 = -70, 70

from filter_build import TERRAIN

# 1) 用 anvil-parser 独立提取
ref = []
for mca in sorted(glob.glob(os.path.join(REGION_DIR, '*.mca'))):
    m = re.search(r'r\.(-?\d+)\.(-?\d+)\.mca$', os.path.basename(mca))
    rx, rz = int(m.group(1)), int(m.group(2))
    region = anvil.Region.from_file(mca)
    for cx in range(rx*32, rx*32+32):
        for cz in range(rz*32, rz*32+32):
            if cx*16+15 < X0 or cx*16 > X1 or cz*16+15 < Z0 or cz*16 > Z1:
                continue
            if region.chunk_location(cx, cz) == (0, 0):
                continue
            chunk = region.get_chunk(cx, cz)
            for dx in range(16):
                for dz in range(16):
                    wx = cx*16+dx; wz = cz*16+dz
                    if not (X0 <= wx <= X1 and Z0 <= wz <= Z1): continue
                    for wy in range(Y0, Y1+1):
                        b = chunk.get_block(dx, wy, dz)
                        bid = b.id.replace('minecraft:', '')
                        if bid in ('air','cave_air','void_air') or bid in TERRAIN:
                            continue
                        ref.append((wx, wy, wz, bid))

# 2) 我的 build_data.json
mine = json.load(open(r"C:\Users\janic\Downloads\mc_walkthrough\build_data.json", encoding='utf-8'))
# build_data 坐标是归一化过的；基准 = ref 的最小世界坐标
xs=[p[0] for p in ref]; ys=[p[1] for p in ref]; zs=[p[2] for p in ref]
bx0, by0, bz0 = min(xs), min(ys), min(zs)
ref_norm = set((p[0]-bx0, p[1]-by0, p[2]-bz0, p[3]) for p in ref)
mine_norm = set((b['x'], b['y'], b['z'], b['id']) for b in mine['blocks'])

print("官方 anvil-parser 方块数:", len(ref_norm))
print("手写解析 方块数:", len(mine_norm))
only_ref = ref_norm - mine_norm
only_mine = mine_norm - ref_norm
print("只在官方库里有(手写漏掉):", len(only_ref))
print("只在我解析里有(多出):", len(only_mine))
if only_ref: print("  官方独有示例:", list(only_ref)[:5])
if only_mine: print("  手写独有示例:", list(only_mine)[:5])
print("结论:", "完全一致 ✓✓" if not only_ref and not only_mine else "有差异 ✗")
