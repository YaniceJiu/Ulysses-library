# -*- coding: utf-8 -*-
"""重新提取建筑方块，保留每个方块的朝向属性(Properties)，输出 build_data.json"""
import sys, json, os
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"
X0, X1 = -112, -6
Z0, Z1 = -64, 34
Y0, Y1 = -70, 70

from filter_build import TERRAIN

blocks = []
for root in chunk_iter(REGION):
    cx, cz = root.get('xPos'), root.get('zPos')
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
                bid = name.replace('minecraft:', '')
                if bid in TERRAIN: continue
                blocks.append({"x": wx, "y": wy, "z": wz, "id": bid,
                               "p": dict(props) if isinstance(props, dict) else {}})

xs = [b['x'] for b in blocks]; ys = [b['y'] for b in blocks]; zs = [b['z'] for b in blocks]
bx0, by0, bz0 = min(xs), min(ys), min(zs)
for b in blocks:
    b['x'] -= bx0; b['y'] -= by0; b['z'] -= bz0

out = {
    "size": [max(xs)-bx0+1, max(ys)-by0+1, max(zs)-bz0+1],
    "blocks": blocks,
}
dst = r"C:\Users\janic\Downloads\mc_walkthrough\build_data.json"
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f)
print("方块数:", len(blocks), " 尺寸:", out["size"])
print("写入:", dst)

# 打印所有不同的方块状态组合，用于决定形状
from collections import Counter
states = Counter((b['id'], tuple(sorted(b['p'].items()))) for b in blocks)
print("\n不同方块状态数:", len(states))
for (bid, props), cnt in states.most_common():
    print("  %-32s %-40s x%d" % (bid, json.dumps(dict(props), ensure_ascii=False), cnt))
