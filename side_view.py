# -*- coding: utf-8 -*-
"""渲染建筑区域的侧视剖面图，直观显示地形/建筑/屋顶结构"""
import sys, os
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter, section_blocks
from PIL import Image

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"
X0, X1 = -80, 0
Z0, Z1 = -64, 0
Y0, Y1 = -70, 40

TERRAIN = {'dirt','grass_block','stone','deepslate','bedrock','tuff','gravel','sand','clay',
           'cobbled_deepslate','dripstone_block','andesite','diorite','granite','mud','sculk',
           'sculk_vein','sculk_catalyst','snow_block','water','lava','rooted_dirt','dirt_path',
           'smooth_basalt','basalt','blackstone','magma_block','obsidian','cave_air','void_air',
           'glowstone','moss_block','moss_carpet','flowering_azalea','azalea','short_grass',
           'tall_grass','fern','vine','glow_lichen','spore_blossom','pink_petals'}

blocks = []
for root in chunk_iter(REGION):
    cx, cz = root.get('xPos'), root.get('zPos')
    if cx*16+15 < X0 or cx*16 > X1 or cz*16+15 < Z0 or cz*16 > Z1: continue
    for sec in root.get('sections', []) or []:
        sy, sb = section_blocks(sec)
        if sb is None: continue
        for i, (name, props) in enumerate(sb):
            if name == 'minecraft:air': continue
            wx = cx*16+(i&15); wy = sy*16+((i>>8)&15); wz = cz*16+((i>>4)&15)
            if X0<=wx<=X1 and Z0<=wz<=Z1 and Y0<=wy<=Y1:
                blocks.append((wx,wy,wz,name.replace('minecraft:','')))

def side_view(z_fixed, fname):
    W = X1-X0+1; H = Y1-Y0+1
    img = Image.new('RGB', (W, H), (245,245,245))
    px = img.load()
    for wx,wy,wz,bid in blocks:
        if wz != z_fixed: continue
        x = wx-X0; y = Y1-wy
        if bid in TERRAIN:
            if bid == 'grass_block': c = (110,170,80)
            elif bid == 'water': c = (70,120,220)
            else: c = (150,120,90)
        else:
            c = (30,60,200)  # 建筑方块=蓝
        px[x, y] = c
    img = img.resize((W*2, H*2), Image.NEAREST)
    img.save(fname)
    print('已生成', fname, '(x:%d..%d, y:%d..%d, 剖面z=%d)' % (X0,X1,Y0,Y1,z_fixed))

side_view(-42, 'side_z42.png')   # 用户所在列
side_view(-30, 'side_z30.png')
side_view(-10, 'side_z10.png')
