# -*- coding: utf-8 -*-
"""从世界存档中按坐标框提取建筑方块，输出体素 JSON"""
import sys, os, json, glob, struct, zlib, gzip, io, math
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

# 候选范围（结构方块标出的图书馆区域，留些余量）
X0, X1 = -112, -6
Z0, Z1 = -64, 34
Y0, Y1 = -70, 70

blocks = {}   # (x,y,z) -> (id, props)
for root in chunk_iter(REGION):
    cx, cz = root.get('xPos'), root.get('zPos')
    # 快速跳过：区块不在范围内
    if cx*16+15 < X0 or cx*16 > X1 or cz*16+15 < Z0 or cz*16 > Z1:
        continue
    for sec in root.get('sections', []) or []:
        sy, sec_blocks = section_blocks(sec)
        if sec_blocks is None: continue
        sy0, sy1 = sy*16, sy*16+15
        if sy1 < Y0 or sy0 > Y1: continue
        for i, (name, props) in enumerate(sec_blocks):
            if name == 'minecraft:air': continue
            wx = cx*16 + (i & 15)
            wy = sy*16 + ((i >> 8) & 15)
            wz = cz*16 + ((i >> 4) & 15)
            if X0 <= wx <= X1 and Z0 <= wz <= Z1 and Y0 <= wy <= Y1:
                blocks[(wx, wy, wz)] = (name, props)

if not blocks:
    print("范围内没有任何方块！")
    sys.exit(1)

# 实际包围盒
xs = [p[0] for p in blocks]; ys = [p[1] for p in blocks]; zs = [p[2] for p in blocks]
bx0, by0, bz0 = min(xs), min(ys), min(zs)
bx1, by1, bz1 = max(xs), max(ys), max(zs)
print("实际建筑包围盒: x[%d..%d] y[%d..%d] z[%d..%d]" % (bx0, bx1, by0, by1, bz0, bz1))
print("尺寸: %d x %d x %d (W x H x D)" % (bx1-bx0+1, by1-by0+1, bz1-bz0+1))
print("非空气方块数:", len(blocks))

# 输出 JSON（坐标归一化到 0 起始，y 以建筑底部为 0）
out = {
    "size": [bx1-bx0+1, by1-by0+1, bz1-bz0+1],
    "origin": [bx0, by0, bz0],
    "blocks": [
        {"x": x-bx0, "y": y-by0, "z": z-bz0,
         "id": name.replace('minecraft:', '')}
        for (x, y, z), (name, props) in sorted(blocks.items())
    ],
}
outpath = r"C:\Users\janic\Downloads\mc_walkthrough\library_blocks.json"
with open(outpath, 'w', encoding='utf-8') as f:
    json.dump(out, f)
print("已写入:", outpath)

# 统计方块类型
from collections import Counter
c = Counter(b["id"] for b in out["blocks"])
print("\n方块类型分布 Top 20:")
for k, v in c.most_common(20):
    print("  %-30s %d" % (k, v))
