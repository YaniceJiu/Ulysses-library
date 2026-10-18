# -*- coding: utf-8 -*-
"""从指定用户位置做连通分析找建筑边界（参数化）"""
import sys
from collections import deque, Counter
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

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
    'sugar_cane','cactus','dead_bush','large_fern','bamboo','bamboo_sapling','kelp','seagrass',
    'lily_pad','cocoa','sweet_berry_bush','cave_vines','cave_vines_plant','big_dripleaf',
    'small_dripleaf','hanging_roots','pale_hanging_moss','fire','soul_fire','campfire',
    'brown_mushroom','red_mushroom','torch','wall_torch','soul_wall_torch','lantern',
}

# 从参数读用户位置
UX, UY, UZ = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
PAD = int(sys.argv[4]) if len(sys.argv) > 4 else 60
X0, X1, Z0, Z1, Y0, Y1 = UX-PAD, UX+PAD, UZ-PAD, UZ+PAD, -70, 60

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
                blocks[(wx, wy, wz)] = name.replace('minecraft:', '')

start = (UX, UY, UZ)
def is_building(p):
    b = blocks.get(p)
    return b is not None and b not in NATURE

q = deque([start]); seen = set(); cells = set()
while q:
    p = q.popleft()
    if p in seen: continue
    seen.add(p)
    if not is_building(p): continue
    cells.add(p)
    x, y, z = p
    for d in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
        n = (x+d[0], y+d[1], z+d[2])
        if n not in seen: q.append(n)

if not cells:
    print("起始点不是建筑方块"); sys.exit(1)
xs=[p[0] for p in cells]; ys=[p[1] for p in cells]; zs=[p[2] for p in cells]
bx0,bx1,by0,by1,bz0,bz1 = min(xs),max(xs),min(ys),max(ys),min(zs),max(zs)
print("建筑边界: x[%d..%d] y[%d..%d] z[%d..%d]" % (bx0,bx1,by0,by1,bz0,bz1))
W,H,D = bx1-bx0+1, by1-by0+1, bz1-bz0+1
print("尺寸 %dx%dx%d, 方块 %d, 占用率 %.1f%%" % (W,H,D,len(cells),len(cells)/(W*H*D)*100))
# 屋顶检测：顶部2层覆盖率
area = (W)*(D)
top_cov = sum(1 for p in cells if p[1] >= by1-1)/area
print("屋顶覆盖(顶部2层): %.0f%%" % (top_cov*100))
per_y = Counter(p[1] for p in cells)
print("每层方块数 (最后6层):")
for y in range(by1-5, by1+1):
    print("   y=%3d: %d" % (y, per_y.get(y,0)))
print("方块类型:")
c = Counter(blocks[p] for p in cells)
for k,v in c.most_common(20):
    print("   %-30s %d" % (k,v))
