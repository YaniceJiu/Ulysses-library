# -*- coding: utf-8 -*-
"""打印用户脚底房间的布局图，用于验证读取精度"""
import sys
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"
cx0, cx1, cz0, cz1 = -42, -32, -47, -37
grid = {}
for root in chunk_iter(REGION):
    cxx, czz = root.get('xPos'), root.get('zPos')
    if cxx*16+15 < cx0 or cxx*16 > cx1 or czz*16+15 < cz0 or czz*16 > cz1: continue
    for sec in root.get('sections', []) or []:
        sy, sb = section_blocks(sec)
        if sb is None: continue
        for i, (name, props) in enumerate(sb):
            if name == 'minecraft:air': continue
            wx = cxx*16+(i&15); wy = sy*16+((i>>8)&15); wz = czz*16+((i>>4)&15)
            if cx0 <= wx <= cx1 and cz0 <= wz <= cz1 and wy == -56:
                grid[(wx, wz)] = name.replace('minecraft:', '')

short = {
    'yellow_carpet':'黄毯','blue_carpet':'蓝毯','gray_carpet':'灰毯','green_carpet':'绿毯',
    'light_blue_carpet':'浅蓝毯','white_carpet':'白毯','black_carpet':'黑毯','cyan_carpet':'青毯',
    'dark_oak_fence':'深栅','oak_fence':'橡栅','spruce_fence':'云栅','acacia_fence':'金栅',
    'oak_planks':'木板','spruce_planks':'云板','birch_planks':'白桦板','dark_oak_planks':'深板',
    'grindstone':'磨石','loom':'织机','glow_lichen':'荧苔','cyan_terracotta':'青陶',
    'bookshelf':'书架','spruce_shelf':'云架','glass_pane':'玻璃','red_nether_brick_wall':'红砖墙',
    'black_wool':'黑毛','white_wool':'白毛','yellow_wool':'黄毛','green_wool':'绿毛',
    'ochre_froglight':'蛙灯','end_rod':'末烛','quartz_block':'石英','smooth_quartz':'滑石英',
    'acacia_slab':'金阶','torch':'火把','lantern':'灯笼','red_concrete':'红混','black_concrete':'黑混',
    'pale_oak_door':'门','iron_bars':'铁栏','purple_wool':'紫毛','stripped_pale_oak_wood':'去皮木',
    'mangrove_stairs':'红树梯','wither_skeleton_skull':'骷髅','candle':'烛','sculk_sensor':'幽感器',
    'brown_mushroom_block':'蘑菇','spruce_log':'云原木','oak_log':'橡原木','moss_block':'苔藓',
    'flowering_azalea':'杜鹃花','azalea':'杜鹃','pale_oak_leaves':'白桦叶','flowering_azalea_leaves':'杜鹃叶',
    'glass':'玻璃块','dark_oak_trapdoor':'深活板','spruce_trapdoor':'云活板','chain':'锁链',
}
def name(b):
    if b is None: return '····'
    return short.get(b, (b[:2] + '?') if len(b) >= 2 else '??')

print('你脚底 y=-56 层，左上角 (x=-32,z=-37)，右下角 (x=-42,z=-47)：')
print('       ' + ' '.join('%3d' % wx for wx in range(cx1, cx0-1, -1)))
for wz in range(cz1, cz0-1, -1):
    cells = []
    for wx in range(cx1, cx0-1, -1):
        b = grid.get((wx, wz))
        if wx == -37 and wz == -42:
            cells.append('[你]')
        else:
            cells.append(name(b))
    print('  z=%3d | %s' % (wz, ' '.join(cells)))
