# -*- coding: utf-8 -*-
"""从用户位置出发，通过连通性找到建筑真实边界"""
import sys
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

# 自然/地形方块（不算建筑）
NATURE = {
    'dirt','grass_block','stone','deepslate','bedrock','tuff','gravel','sand','clay',
    'cobbled_deepslate','dripstone_block','andesite','diorite','granite','mud','sculk',
    'sculk_vein','sculk_catalyst','sculk_sensor','sculk_shrieker','snow_block','water','lava',
    'rooted_dirt','dirt_path','smooth_basalt','basalt','blackstone','magma_block','obsidian',
    'cave_air','void_air','glowstone','moss_block','moss_carpet','flowering_azalea','azalea',
    'short_grass','tall_grass','fern','vine','glow_lichen','spore_blossom','pink_petals',
    'oak_leaves','spruce_leaves','birch_leaves','dark_oak_leaves','jungle_leaves','acacia_leaves',
    'cherry_leaves','pale_oak_leaves','flowering_azalea_leaves','azalea_leaves','mangrove_leaves',
    'oak_log','spruce_log','birch_log','dark_oak_log','jungle_log','acacia_log','cherry_log',
    'pale_oak_log','mangrove_log','poppy','dandelion','torchflower','peony','lilac','rose_bush',
    'sunflower','azure_bluet','cornflower','allium','lily_of_the_valley','oxeye_daisy',
    'blue_orchid','pink_tulip','red_tulip','orange_tulip','white_tulip','wither_rose',
    'sugar_cane','cactus','dead_bush','fern','large_fern','bamboo','bamboo_sapling',
    'kelp','seagrass','lily_pad','cocoa','sweet_berry_bush','cave_vines','cave_vines_plant',
    'big_dripleaf','small_dripleaf','glow_lichen','hanging_roots','pale_hanging_moss',
    'spore_blossom','fire','soul_fire','campfire','brown_mushroom','red_mushroom',
}

X0, X1, Z0, Z1, Y0, Y1 = -90, 10, -70, 20, -70, 50
blocks = {}
for root in chunk_iter(REGION):
    cxx, czz = root.get('xPos'), root.get('zPos')
    if cxx*16+15 < X0 or cxx*16 > X1 or czz*16+15 < Z0 or czz*16 > Z1: continue
    for sec in root.get('sections', []) or []:
        sy, sb = section_blocks(sec)
        if sb is None: continue
        for i, (name, props) in enumerate(sb):
            if name == 'minecraft:air': continue
            wx = cxx*16+(i&15); wy = sy*16+((i>>8)&15); wz = czz*16+((i>>4)&15)
            if X0 <= wx <= X1 and Z0 <= wz <= Z1 and Y0 <= wy <= Y1:
                bid = name.replace('minecraft:', '')
                blocks[(wx, wy, wz)] = bid

# 从用户位置开始 BFS 找连通的建筑方块
start = (-37, -56, -42)
is_building = lambda p: p in blocks and blocks[p] not in NATURE

from collections import deque
seen = set()
q = deque([start])
building_cells = set()
while q:
    p = q.popleft()
    if p in seen: continue
    seen.add(p)
    if not is_building(p):
        continue
    building_cells.add(p)
    x, y, z = p
    for d in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
        n = (x+d[0], y+d[1], z+d[2])
        if n not in seen:
            q.append(n)

if not building_cells:
    print("起始点不是建筑方块!")
    sys.exit(1)
xs=[p[0] for p in building_cells]; ys=[p[1] for p in building_cells]; zs=[p[2] for p in building_cells]
print("建筑真实边界 (从你位置连通):")
print("  x[%d..%d] y[%d..%d] z[%d..%d]" % (min(xs),max(xs),min(ys),max(ys),min(zs),max(zs)))
print("  尺寸 %dx%dx%d, 方块数 %d" % (max(xs)-min(xs)+1, max(ys)-min(ys)+1, max(zs)-min(zs)+1, len(building_cells)))
print("  占用率 %.1f%%" % (len(building_cells)/((max(xs)-min(xs)+1)*(max(ys)-min(ys)+1)*(max(zs)-min(zs)+1))*100))

# 检查建筑方块类型分布
from collections import Counter
c = Counter(blocks[p] for p in building_cells)
print("\n建筑方块类型:")
for k, v in c.most_common(25):
    print("   %-30s %d" % (k, v))
