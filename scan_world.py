# -*- coding: utf-8 -*-
"""扫描 Minecraft 世界，找出结构方块位置（= 建筑所在处）和出生点"""
import os, glob, sys
import anvil

WORLD = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2"
REGION_DIR = os.path.join(WORLD, "dimensions", "minecraft", "overworld", "region")

# 1) 出生点
try:
    import nbtlib
    level = nbtlib.load(os.path.join(WORLD, "level.dat"))
    data = level[""].root  # type: ignore
    spawn = (data["Data"]["SpawnX"], data["Data"]["SpawnY"], data["Data"]["SpawnZ"])
    print("出生点 Spawn:", spawn)
except Exception as e:
    print("读取出生点失败:", e)

# 2) 扫描所有区域里的结构方块
print("\n扫描结构方块 (structure_block) ...")
found = []
for mca in sorted(glob.glob(os.path.join(REGION_DIR, "*.mca"))):
    try:
        region = anvil.Region.from_file(mca)
    except Exception as e:
        print("  跳过区域文件错误:", mca, e)
        continue
    for cx, cz in region.chunk_coords():
        try:
            chunk = region.get_chunk(cx, cz)
        except Exception:
            continue
        for pos, te in (chunk.get_tile_entities() or {}).items():
            if te.get("id") == "minecraft:structure_block":
                # pos 是 dict {x, y, z}
                x, y, z = pos["x"], pos["y"], pos["z"]
                found.append({
                    "pos": (x, y, z),
                    "mode": te.get("mode", "?"),
                    "size": (te.get("sizeX", 0), te.get("sizeY", 0), te.get("sizeZ", 0)),
                    "name": te.get("name", ""),
                })

if not found:
    print("  没有找到结构方块")
else:
    for f in found:
        print("  结构方块 @", f["pos"], " mode=", f["mode"],
              " size=", f["size"], " name=", f["name"])
