# -*- coding: utf-8 -*-
"""为每个方块 ID 生成近似颜色，输出 colors.js"""
import json

# 常见方块颜色（RGB 0-255），未列出的走默认
COLORS = {
    # 基础
    'stone': (128,128,128), 'cobblestone': (130,130,130), 'mossy_cobblestone': (115,130,110),
    'bedrock': (48,48,48), 'deepslate': (100,100,105), 'cobbled_deepslate': (95,95,100),
    'dirt': (134,96,67), 'grass_block': (106,170,84), 'grass_path': (155,130,90),
    'gravel': (136,130,126), 'sand': (219,210,164), 'smooth_sandstone': (219,206,164),
    'sandstone': (216,203,158), 'cut_sandstone': (219,206,164), 'red_sand': (191,113,63),
    'red_sandstone': (190,104,55), 'clay': (160,166,178), 'terracotta': (151,100,74),
    'light_gray_terracotta': (135,107,98), 'gray_terracotta': (87,69,63),
    'brown_terracotta': (77,51,36), 'cyan_terracotta': (88,91,93), 'black_terracotta': (58,42,36),
    'water': (63,118,228), 'lava': (207,84,15), 'ice': (146,181,235), 'packed_ice': (132,158,196),
    'snow_block': (249,254,254), 'snow': (245,250,255), 'mud': (92,64,44),
    'andesite': (136,136,140), 'diorite': (191,191,191), 'granite': (146,112,105),
    'tuff': (106,102,102), 'calcite': (222,218,207), 'dripstone_block': (140,94,76),
    'magma_block': (139,78,38), 'obsidian': (20,16,35), 'crying_obsidian': (27,13,54),
    'netherrack': (94,42,42), 'end_stone': (220,226,170), 'basalt': (78,78,84),
    'blackstone': (40,32,38), 'smooth_basalt': (82,82,88), 'soul_sand': (83,64,55),
    'soul_soil': (75,58,47), 'sculk': (11,31,27), 'sculk_catalyst': (16,40,33),
    'sculk_sensor': (52,62,51), 'sculk_shrieker': (15,34,29), 'amethyst_block': (118,84,196),
    'glowstone': (210,175,105), 'sea_lantern': (170,194,206), 'shroomlight': (255,158,91),
    'ochre_froglight': (223,190,110), 'verdant_froglight': (122,222,174), 'pearlescent_froglight': (224,150,216),
    # 木头/木板/栅栏
    'oak_log': (111,84,43), 'oak_planks': (162,132,83), 'oak_fence': (162,132,83),
    'oak_door': (162,132,83), 'oak_stairs': (162,132,83), 'oak_slab': (162,132,83),
    'oak_leaves': (84,124,54),
    'spruce_log': (69,50,34), 'spruce_planks': (110,85,55), 'spruce_fence': (110,85,55),
    'spruce_door': (110,85,55), 'spruce_stairs': (110,85,55), 'spruce_slab': (110,85,55),
    'spruce_leaves': (70,94,52), 'spruce_shelf': (110,85,55),
    'birch_log': (198,194,168), 'birch_planks': (198,190,150), 'birch_fence': (198,190,150),
    'birch_leaves': (95,132,66),
    'dark_oak_log': (54,38,23), 'dark_oak_planks': (65,47,28), 'dark_oak_fence': (65,47,28),
    'dark_oak_door': (65,47,28), 'dark_oak_stairs': (65,47,28), 'dark_oak_leaves': (55,71,41),
    'jungle_log': (92,75,43), 'jungle_planks': (171,128,102), 'jungle_leaves': (73,107,55),
    'acacia_log': (90,85,82), 'acacia_planks': (170,97,68), 'acacia_leaves': (113,139,64),
    'mangrove_log': (95,56,44), 'mangrove_planks': (127,77,60), 'mangrove_leaves': (88,103,54),
    'cherry_log': (74,53,53), 'cherry_planks': (224,177,169), 'cherry_leaves': (238,168,182),
    'pale_oak_log': (170,165,156), 'pale_oak_planks': (215,210,198), 'pale_oak_door': (215,210,198),
    'pale_oak_fence': (215,210,198), 'pale_oak_leaves': (148,164,152),
    'crimson_planks': (140,80,90), 'crimson_fence': (140,80,90), 'warped_planks': (52,100,110),
    'warped_fence': (52,100,110),
    'bamboo': (112,167,84), 'bamboo_planks': (190,172,119), 'bamboo_block': (145,124,66),
    # 石头类建材
    'stone_bricks': (124,124,124), 'stone_brick_stairs': (124,124,124), 'stone_brick_slab': (124,124,124),
    'chiseled_stone_bricks': (124,124,124), 'cracked_stone_bricks': (110,110,112),
    'mossy_stone_bricks': (117,122,108), 'smooth_stone': (158,158,158),
    'bricks': (150,83,74), 'brick_stairs': (150,83,74), 'brick_wall': (150,83,74),
    'nether_bricks': (43,20,20), 'red_nether_bricks': (60,15,10), 'red_nether_brick_wall': (60,15,10),
    'quartz_block': (236,232,224), 'smooth_quartz': (236,232,224), 'quartz_pillar': (232,226,214),
    'chiseled_quartz_block': (236,232,224), 'quartz_bricks': (232,228,218),
    'purpur_block': (170,126,170), 'purpur_pillar': (170,126,170),
    'prismarine': (100,162,150), 'prismarine_bricks': (96,160,157), 'dark_prismarine': (56,88,83),
    'polished_andesite': (138,138,142), 'polished_diorite': (196,196,196), 'polished_granite': (152,116,110),
    'polished_deepslate': (100,100,105), 'polished_blackstone': (42,34,40),
    'blackstone_bricks': (42,34,40), 'polished_blackstone_bricks': (42,34,40),
    # 玻璃
    'glass': (200,220,235), 'glass_pane': (200,220,235),
    'white_stained_glass': (240,240,240), 'white_stained_glass_pane': (240,240,240),
    'gray_stained_glass': (60,60,65), 'gray_stained_glass_pane': (60,60,65),
    'light_gray_stained_glass': (140,140,145), 'light_gray_stained_glass_pane': (140,140,145),
    'black_stained_glass': (28,28,30), 'black_stained_glass_pane': (28,28,30),
    'blue_stained_glass': (60,90,190), 'blue_stained_glass_pane': (60,90,190),
    'light_blue_stained_glass': (120,180,225), 'light_blue_stained_glass_pane': (120,180,225),
    'cyan_stained_glass': (70,170,170), 'cyan_stained_glass_pane': (70,170,170),
    'green_stained_glass': (70,160,80), 'green_stained_glass_pane': (70,160,80),
    'lime_stained_glass': (140,210,90), 'lime_stained_glass_pane': (140,210,90),
    'yellow_stained_glass': (245,225,90), 'yellow_stained_glass_pane': (245,225,90),
    'orange_stained_glass': (235,150,50), 'orange_stained_glass_pane': (235,150,50),
    'red_stained_glass': (200,60,55), 'red_stained_glass_pane': (200,60,55),
    'pink_stained_glass': (235,150,190), 'pink_stained_glass_pane': (235,150,190),
    'magenta_stained_glass': (205,95,200), 'magenta_stained_glass_pane': (205,95,200),
    'purple_stained_glass': (150,70,200), 'purple_stained_glass_pane': (150,70,200),
    'brown_stained_glass': (120,75,50), 'brown_stained_glass_pane': (120,75,50),
    # 羊毛/地毯（按颜色）
    'white_wool': (232,232,232), 'white_carpet': (232,232,232),
    'light_gray_wool': (155,157,160), 'light_gray_carpet': (155,157,160),
    'gray_wool': (65,65,68), 'gray_carpet': (65,65,68),
    'black_wool': (26,26,29), 'black_carpet': (26,26,29),
    'blue_wool': (48,70,160), 'blue_carpet': (48,70,160),
    'light_blue_wool': (110,170,230), 'light_blue_carpet': (110,170,230),
    'cyan_wool': (24,140,140), 'cyan_carpet': (24,140,140),
    'green_wool': (70,130,55), 'green_carpet': (70,130,55),
    'lime_wool': (120,200,60), 'lime_carpet': (120,200,60),
    'yellow_wool': (230,215,45), 'yellow_carpet': (230,215,45),
    'orange_wool': (230,135,25), 'orange_carpet': (230,135,25),
    'red_wool': (170,50,45), 'red_carpet': (170,50,45),
    'pink_wool': (235,145,180), 'pink_carpet': (235,145,180),
    'magenta_wool': (190,80,185), 'magenta_carpet': (190,80,185),
    'purple_wool': (125,50,180), 'purple_carpet': (125,50,180),
    'brown_wool': (100,70,45), 'brown_carpet': (100,70,45),
    # 混凝土
    'white_concrete': (208,208,208), 'light_gray_concrete': (125,128,132),
    'gray_concrete': (55,58,62), 'black_concrete': (8,10,15),
    'blue_concrete': (45,48,145), 'light_blue_concrete': (35,135,205),
    'cyan_concrete': (0,130,130), 'green_concrete': (75,135,45),
    'lime_concrete': (110,190,40), 'yellow_concrete': (235,195,10),
    'orange_concrete': (225,110,20), 'red_concrete': (145,35,35),
    'pink_concrete': (215,120,145), 'magenta_concrete': (170,60,160),
    'purple_concrete': (100,30,150), 'brown_concrete': (95,60,35),
    # 功能方块
    'bookshelf': (165,130,84), 'shelf': (160,124,78), 'chiseled_bookshelf': (160,124,78),
    'chest': (150,110,55), 'barrel': (140,105,52), 'lectern': (160,125,82),
    'crafting_table': (120,90,50), 'furnace': (115,115,115), 'smoker': (100,90,80),
    'campfire': (140,90,40), 'lantern': (235,190,90), 'soul_lantern': (90,180,220),
    'torch': (235,190,90), 'soul_torch': (90,180,220), 'end_rod': (235,235,235),
    'sea_lantern': (170,194,206), 'bell': (230,190,70), 'beacon': (150,230,230),
    'anvil': (60,60,60), 'enchanting_table': (140,40,60), 'ender_chest': (30,45,40),
    'jukebox': (150,120,80), 'note_block': (120,80,50), 'spawner': (30,40,50),
    'shulker_box': (120,80,110), 'white_shulker_box': (200,190,195),
    'decorated_pot': (150,90,70), 'flower_pot': (150,90,70),
    'banner': (200,160,60), 'white_banner': (200,200,200),
    'sign': (160,130,85), 'hanging_sign': (120,95,60), 'wither_skeleton_skull': (35,35,38),
    'skeleton_skull': (200,195,185), 'player_head': (180,140,110), 'skull': (180,140,110),
    'candle': (240,230,200), 'white_candle': (240,230,200),
    'red_candle': (180,60,50), 'blue_candle': (60,90,180),
    'ladder': (180,150,100), 'iron_bars': (170,170,175), 'chain': (160,160,160),
    'iron_door': (170,170,175), 'iron_trapdoor': (170,170,175),
    'conduit': (120,180,220), 'brewing_stand': (150,140,130),
    'cauldron': (90,90,95), 'hopper': (90,90,95), 'piston': (120,120,120),
    'observer': (120,120,120), 'dispenser': (120,120,120), 'dropper': (120,120,120),
    'oak_trapdoor': (162,132,83), 'spruce_trapdoor': (110,85,55), 'dark_oak_trapdoor': (65,47,28),
    'pale_oak_trapdoor': (215,210,198), 'iron_block': (210,210,215), 'gold_block': (245,210,60),
    'diamond_block': (105,225,220), 'emerald_block': (60,215,95), 'lapis_block': (30,60,150),
    'netherite_block': (70,65,70), 'copper_block': (200,120,95), 'exposed_copper': (160,140,115),
    'waxed_copper_block': (200,120,95), 'redstone_block': (190,40,20), 'coal_block': (30,30,30),
    'hay_block': (170,140,60), 'dried_kelp_block': (60,90,70), 'bone_block': (220,215,190),
    'target': (230,220,210), 'slime_block': (125,200,95), 'honey_block': (255,150,30),
    'honeycomb_block': (240,155,60), 'moss_block': (90,140,60), 'moss_carpet': (95,150,65),
    'sugar_cane': (130,180,90), 'cactus': (100,160,70), 'bamboo': (112,167,84),
    'lily_pad': (60,140,70), 'mushroom_stem': (200,195,185), 'brown_mushroom_block': (145,110,90),
    'red_mushroom_block': (185,60,50), 'crimson_stem': (90,45,60), 'warped_stem': (55,95,90),
    'crimson_nylium': (150,50,70), 'warped_nylium': (45,110,90),
    'ochre_froglight': (223,190,110), 'pearlescent_froglight': (224,150,216),
    'frogspawn': (60,70,80), 'trial_spawner': (60,55,70), 'vault': (120,115,130),
    'copper_grate': (195,115,90), 'tinted_glass': (70,80,90),
    'resin_block': (235,160,60), 'pale_moss_block': (175,185,170), 'pale_moss_carpet': (180,190,175),
    'pale_hanging_moss': (175,185,170), 'pale_oak_wood': (170,165,156),
    'stripped_pale_oak_log': (200,195,185), 'stripped_pale_oak_wood': (200,195,185),
    'pale_oak_fence_gate': (215,210,198), 'pale_oak_stairs': (215,210,198), 'pale_oak_slab': (215,210,198),
    'pale_oak_pressure_plate': (215,210,198), 'pale_oak_button': (215,210,198),
    'pale_oak_hanging_sign': (170,165,156), 'spruce_hanging_sign': (90,70,45),
    'dark_oak_hanging_sign': (55,40,24), 'oak_hanging_sign': (120,95,60),
    'white_bed': (235,235,235), 'red_bed': (170,50,45), 'blue_bed': (48,70,160),
    'light_blue_bed': (110,170,230), 'green_bed': (70,130,55), 'yellow_bed': (230,215,45),
    'black_bed': (26,26,29), 'gray_bed': (65,65,68), 'cyan_bed': (24,140,140),
    'pink_bed': (235,145,180), 'purple_bed': (125,50,180), 'orange_bed': (230,135,25),
    'lime_bed': (120,200,60), 'brown_bed': (100,70,45), 'magenta_bed': (190,80,185),
    'cobweb': (200,200,200), 'nether_wart_block': (110,20,35), 'warped_wart_block': (40,120,110),
    'shroomlight': (255,158,91),
}

def hsl_to_rgb(h, s, l):
    c = (1 - abs(2*l-1)) * s
    hp = h / 60.0
    x = c * (1 - abs(hp % 2 - 1))
    if hp < 1: r,g,b = c,x,0
    elif hp < 2: r,g,b = x,c,0
    elif hp < 3: r,g,b = 0,c,x
    elif hp < 4: r,g,b = 0,x,c
    elif hp < 5: r,g,b = x,0,c
    else: r,g,b = c,0,x
    m = l - c/2
    return (int((r+m)*255), int((g+m)*255), int((b+m)*255))

def color_for(block_id):
    if block_id in COLORS:
        return COLORS[block_id]
    # 尝试从 ID 里猜颜色：wool/carpet/concrete/stained_glass/terracotta 带颜色前缀
    parts = block_id.split('_')
    if parts[0] in ('white','light_gray','gray','black','blue','light_blue','cyan','green',
                    'lime','yellow','orange','red','pink','magenta','purple','brown'):
        color = parts[0]
        base = '_'.join(parts[1:])
        # 用对应颜色的 wool 色
        wool = color + '_wool'
        if wool in COLORS:
            return COLORS[wool]
    return (150,150,150)  # 默认灰

if __name__ == '__main__':
    data = json.load(open(r"C:\Users\janic\Downloads\mc_walkthrough\library_build.json", encoding='utf-8'))
    ids = sorted(set(b['id'] for b in data['blocks']))
    cmap = {i: color_for(i) for i in ids}
    missing = [i for i in ids if i not in COLORS]
    with open(r"C:\Users\janic\Downloads\mc_walkthrough\colors.js", 'w', encoding='utf-8') as f:
        f.write("const BLOCK_COLORS = " + json.dumps(cmap) + ";\n")
    print("生成的配色数量:", len(cmap))
    print("用默认灰色的方块:", missing if missing else "(无)")
