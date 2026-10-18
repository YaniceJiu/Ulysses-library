# -*- coding: utf-8 -*-
"""通用提取：按命令行给定范围提取建筑 -> build_data.json
用法: python extract_candidate.py X0 X1 Z0 Z1 [Y0 Y1]
"""
import sys, json
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks
from filter_build import TERRAIN

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

X0, X1, Z0, Z1 = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
Y0 = int(sys.argv[5]) if len(sys.argv) > 5 else -70
Y1 = int(sys.argv[6]) if len(sys.argv) > 6 else 70

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
            base = name.replace('minecraft:', '')
            if base in TERRAIN: continue
            wx = cx*16 + (i & 15)
            wy = sy*16 + ((i >> 8) & 15)
            wz = cz*16 + ((i >> 4) & 15)
            if X0 <= wx <= X1 and Z0 <= wz <= Z1 and Y0 <= wy <= Y1:
                blocks.append({"x": wx, "y": wy, "z": wz, "id": base,
                               "p": dict(props) if isinstance(props, dict) else {}})

xs = [b['x'] for b in blocks]; ys = [b['y'] for b in blocks]; zs = [b['z'] for b in blocks]
if not blocks:
    print("空！"); sys.exit(1)
bx0, by0, bz0 = min(xs), min(ys), min(zs)
for b in blocks:
    b['x'] -= bx0; b['y'] -= by0; b['z'] -= bz0

out = {"size": [max(xs)-bx0+1, max(ys)-by0+1, max(zs)-bz0+1], "blocks": blocks}
dst = r"C:\Users\janic\Downloads\mc_walkthrough\build_data.json"
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f)
print("范围 x[%d..%d] z[%d..%d] y[%d..%d]" % (X0, X1, Z0, Z1, Y0, Y1))
print("方块数:", len(blocks), " 尺寸:", out["size"], " 占用率: %.1f%%" % (len(blocks)/(out['size'][0]*out['size'][1]*out['size'][2])*100))
print("写入 build_data.json")
# 顶部3层覆盖（看屋顶）
W, H, D = out['size']
from collections import Counter
per_y = Counter(b['y'] for b in blocks)
for y in range(H-3, H):
    print("  y=%2d 占用 %5d / %d (%.0f%%)" % (y, per_y.get(y,0), W*D, per_y.get(y,0)/(W*D)*100))
