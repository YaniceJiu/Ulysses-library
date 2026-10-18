# -*- coding: utf-8 -*-
"""过滤地形方块，只保留建筑；输出精简 JSON"""
import json

TERRAIN = {
    # 只删【真正的地形/自然】；sculk/杜鹃花/木头/树叶都是建筑材料，保留
    'dirt','grass_block','grass_path','stone','deepslate','bedrock','tuff','gravel',
    'sand','andesite','diorite','granite','cobbled_deepslate','dripstone_block',
    'moss_block','coarse_dirt','podzol','mycelium','clay','water','lava',
    'mud','packed_mud','calcite','snow_block','snow','ice','packed_ice','blue_ice',
    'rooted_dirt','dirt_path','smooth_basalt','basalt','blackstone',
    'sandstone','smooth_sandstone','cut_sandstone','chiseled_sandstone','red_sandstone',
    'cave_air','void_air','soul_sand','soul_soil','magma_block','glowstone','obsidian',
    'crying_obsidian','netherrack','end_stone','mossy_cobblestone',
    # 纯自然：花草/藤蔓/树苗
    'short_grass','tall_grass','fern','large_fern','vine','hanging_roots','moss_carpet',
    'sugar_cane','cactus','dead_bush','poppy','dandelion','torchflower',
    'peony','lilac','rose_bush','sunflower','azure_bluet','cornflower','allium',
    'lily_of_the_valley','oxeye_daisy','blue_orchid','pink_tulip','red_tulip',
    'orange_tulip','white_tulip','wither_rose','wheat','carrots','potatoes','beetroots',
    'melon','pumpkin','carved_pumpkin','brown_mushroom','red_mushroom','bamboo',
    'sugarcane','kelp','seagrass','lily_pad','flower_pot','cocoa','sweet_berry_bush',
    'cave_vines','cave_vines_plant','glow_lichen','big_dripleaf','small_dripleaf',
    'amethyst_block','budding_amethyst','amethyst_cluster','large_amethyst_bud',
    'medium_amethyst_bud','small_amethyst_bud','pointed_dripstone',
}

def filter_terrain(blocks):
    return [b for b in blocks if b['id'] not in TERRAIN]

if __name__ == '__main__':
    data = json.load(open(r"C:\Users\janic\Downloads\mc_walkthrough\library_blocks.json", encoding='utf-8'))
    blocks = filter_terrain(data['blocks'])
    if not blocks:
        print("过滤后没有方块！")
        raise SystemExit(1)

    # 重新归一化坐标
    xs = [b['x'] for b in blocks]; ys = [b['y'] for b in blocks]; zs = [b['z'] for b in blocks]
    bx0, by0, bz0 = min(xs), min(ys), min(zs)
    bx1, by1, bz1 = max(xs), max(ys), max(zs)
    for b in blocks:
        b['x'] -= bx0; b['y'] -= by0; b['z'] -= bz0

    out = {
        "size": [bx1-bx0+1, by1-by0+1, bz1-bz0+1],
        "blocks": blocks,
    }
    with open(r"C:\Users\janic\Downloads\mc_walkthrough\library_build.json", 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)

    from collections import Counter
    c = Counter(b['id'] for b in blocks)
    print("建筑方块数:", len(blocks))
    print("建筑实际尺寸: %d x %d x %d" % (out['size'][0], out['size'][1], out['size'][2]))
    print("方块类型 Top 25:")
    for k, v in c.most_common(25):
        print("  %-30s %d" % (k, v))
    print("已写入: library_build.json")
