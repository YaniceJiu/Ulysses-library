# -*- coding: utf-8 -*-
"""从游戏 JAR 提取建筑所需材质，打包成纹理图集 atlas.png + atlas.json"""
import json, os, zipfile
from PIL import Image

JAR = r"C:\Users\janic\AppData\Roaming\.minecraft\versions\26.2\26.2.jar"
OUT = r"C:\Users\janic\Downloads\mc_walkthrough"
JARPREFIX = 'assets/minecraft/textures/block/'

data = json.load(open(os.path.join(OUT, 'build_data.json'), encoding='utf-8'))
ids = sorted(set(b['id'] for b in data['blocks']))

# ---------- 方块 -> 每个面的材质角色 ----------
# 角色: all / top / bottom / side / front / base / sides
def wood_planks(w): return w + '_planks'

def base(name):
    return {'all': name}

BLOCK_TEX = {}
for i in ids:
    BLOCK_TEX[i] = base(i)  # 默认：整块用 block/<id>.png

BLOCK_TEX.update({
    # 蛙光体：侧面/顶底不同
    'ochre_froglight': {'side': 'ochre_froglight_side', 'top': 'ochre_froglight_top', 'bottom': 'ochre_froglight_top'},
    # 玻璃 / 玻璃板
    'glass': base('glass'),
    'glass_pane': {'side': 'glass', 'top': 'glass_pane_top'},
    'black_stained_glass_pane': {'side': 'black_stained_glass', 'top': 'black_stained_glass_pane_top'},
    'gray_stained_glass_pane': {'side': 'gray_stained_glass', 'top': 'gray_stained_glass_pane_top'},
    'light_gray_stained_glass_pane': {'side': 'light_gray_stained_glass', 'top': 'light_gray_stained_glass_pane_top'},
    # 地毯 -> 用羊毛材质
    'blue_carpet': base('blue_wool'),
    'gray_carpet': base('gray_wool'),
    'light_blue_carpet': base('light_blue_wool'),
    'green_carpet': base('green_wool'),
    'yellow_carpet': base('yellow_wool'),
    'black_carpet': base('black_wool'),
    'cyan_carpet': base('cyan_wool'),
    'lime_carpet': base('lime_wool'),
    'orange_carpet': base('orange_wool'),
    'light_gray_carpet': base('light_gray_wool'),
    'red_carpet': base('red_wool'),
    'white_carpet': base('white_wool'),
    # 栅栏 -> 木板
    'spruce_fence': base(wood_planks('spruce')),
    'dark_oak_fence': base(wood_planks('dark_oak')),
    'acacia_fence': base(wood_planks('acacia')),
    'oak_fence': base(wood_planks('oak')),
    'cherry_fence': base(wood_planks('cherry')),
    'mangrove_fence': base(wood_planks('mangrove')),
    # 墙 -> 本体
    'red_nether_brick_wall': base('red_nether_bricks'),
    'blackstone_wall': base('blackstone'),
    'mud_brick_wall': base('mud_bricks'),
    # 门
    'pale_oak_door': {'top': 'pale_oak_door_top', 'bottom': 'pale_oak_door_bottom'},
    # 活板门
    'mangrove_trapdoor': base('mangrove_trapdoor'),
    'spruce_trapdoor': base('spruce_trapdoor'),
    # 楼梯
    'mangrove_stairs': base(wood_planks('mangrove')),
    'oak_stairs': base(wood_planks('oak')),
    'spruce_stairs': base(wood_planks('spruce')),
    'dark_oak_stairs': base(wood_planks('dark_oak')),
    'acacia_stairs': base(wood_planks('acacia')),
    'quartz_stairs': {'all': 'quartz_block_side', 'top': 'quartz_block_top'},
    'smooth_quartz_stairs': base('quartz_block_bottom'),
    'cinnabar_brick_stairs': base('cinnabar_bricks'),
    'prismarine_brick_stairs': base('prismarine_bricks'),
    # 台阶
    'acacia_slab': base(wood_planks('acacia')),
    'oak_slab': base(wood_planks('oak')),
    'quartz_slab': {'all': 'quartz_block_side', 'top': 'quartz_block_top'},
    'smooth_quartz_slab': base('quartz_block_bottom'),
    'polished_blackstone_brick_slab': base('polished_blackstone_bricks'),
    'cut_sandstone_slab': base('cut_sandstone'),
    'polished_tuff_slab': base('polished_tuff'),
    'purpur_slab': base('purpur_block'),
    # 装饰
    'end_rod': base('end_rod'),
    'lantern': base('lantern'),
    'torch': base('torch'),
    'wall_torch': base('torch'),
    'soul_wall_torch': base('soul_torch'),
    'iron_chain': base('iron_chain'),
    'oxidized_copper_chain': base('oxidized_copper_chain'),
    # 书架 / 置物架
    'bookshelf': {'side': 'bookshelf', 'top': 'oak_planks', 'bottom': 'oak_planks'},
    'spruce_shelf': {'side': 'spruce_shelf', 'top': 'spruce_planks', 'bottom': 'spruce_planks'},
    'dark_oak_shelf': {'side': 'dark_oak_shelf', 'top': 'dark_oak_planks', 'bottom': 'dark_oak_planks'},
    'jungle_shelf': {'side': 'jungle_shelf', 'top': 'jungle_planks', 'bottom': 'jungle_planks'},
    'chiseled_bookshelf': {'front': 'chiseled_bookshelf_empty', 'side': 'chiseled_bookshelf_side',
                           'top': 'chiseled_bookshelf_top', 'bottom': 'chiseled_bookshelf_top'},
    # 石英
    'quartz_block': {'all': 'quartz_block_side', 'top': 'quartz_block_top', 'bottom': 'quartz_block_bottom'},
    'smooth_quartz': base('quartz_block_bottom'),
    'gold_block': base('gold_block'),
    # 剥皮原木/木头
    'stripped_pale_oak_wood': {'side': 'stripped_pale_oak_log', 'top': 'stripped_pale_oak_log_top', 'bottom': 'stripped_pale_oak_log_top'},
    'stripped_oak_wood': {'side': 'stripped_oak_log', 'top': 'stripped_oak_log_top', 'bottom': 'stripped_oak_log_top'},
    'stripped_warped_hyphae': {'side': 'stripped_warped_stem', 'top': 'stripped_warped_stem_top', 'bottom': 'stripped_warped_stem_top'},
    'stripped_oak_log': {'side': 'stripped_oak_log', 'top': 'stripped_oak_log_top', 'bottom': 'stripped_oak_log_top'},
    # 烟熏炉
    'smoker': {'front': 'smoker_front', 'side': 'smoker_side', 'top': 'smoker_top', 'bottom': 'smoker_top'},
    # 讲台
    'lectern': {'front': 'lectern_front', 'base': 'lectern_base', 'sides': 'lectern_sides', 'top': 'lectern_top'},
    # 脚手架
    'scaffolding': {'side': 'scaffolding_side', 'top': 'scaffolding_top', 'bottom': 'scaffolding_bottom'},
    # 蛋糕
    'cake': {'side': 'cake_side', 'top': 'cake_top', 'bottom': 'cake_bottom'},
    # 营火
    'campfire': base('campfire_log'),
    # 蜡烛
    'white_candle': base('white_candle'),
    'red_candle': base('red_candle'),
    'candle': base('candle'),
    # 压力板 -> 木板
    'oak_pressure_plate': base(wood_planks('oak')),
    'mangrove_pressure_plate': base(wood_planks('mangrove')),
    'spruce_pressure_plate': base(wood_planks('spruce')),
    'pale_oak_pressure_plate': base(wood_planks('pale_oak')),
    # 潜影盒
    'white_shulker_box': base('white_shulker_box'),
    # 装饰陶瓷
    'decorated_pot': base('decorated_pot'),
    # 末影箱
    'ender_chest': base('obsidian'),
    # 栅栏门 (无) 不用
    'cinnabar_bricks': base('cinnabar_bricks'),
    'polished_andesite': base('polished_andesite'),
    'waxed_weathered_copper_grate': base('weathered_copper_grate'),
    'exposed_copper_bars': base('exposed_copper_bars'),
    'weathered_copper_bars': base('weathered_copper_bars'),
    'iron_bars': base('iron_bars'),
    'light_blue_glazed_terracotta': base('light_blue_glazed_terracotta'),
    'lightning_rod': base('lightning_rod'),
    'exposed_lightning_rod': base('exposed_lightning_rod'),
    'weathered_lightning_rod': base('weathered_lightning_rod'),
    'oxidized_lightning_rod': base('oxidized_lightning_rod'),
    'flowering_azalea_leaves': base('flowering_azalea_leaves'),
    'oak_sapling': base('oak_sapling'),
    'slime_block': base('slime_block'),
    'white_terracotta': base('white_terracotta'),
    'lime_concrete_powder': base('lime_concrete_powder'),
    'cartography_table': {'all': 'cartography_table_side3', 'top': 'cartography_table_top', 'bottom': 'oak_planks'},
    'loom': {'front': 'loom_front', 'side': 'loom_side', 'top': 'loom_top', 'bottom': 'oak_planks'},
    'grindstone': base('grindstone_side'),
    'tripwire_hook': base('tripwire_hook'),
    # 末地烛/悬挂牌等
    'warped_hanging_sign': base('warped_hanging_sign'),
    'warped_wall_hanging_sign': base('warped_hanging_sign'),
    'mangrove_wall_hanging_sign': base('mangrove_hanging_sign'),
    'crimson_hanging_sign': base('crimson_hanging_sign'),
})

# ---------- 收集需要提取的纹理 ----------
needed = set()
for bid, faces in BLOCK_TEX.items():
    for v in faces.values():
        needed.add(v)

z = zipfile.ZipFile(JAR)
have = set(z.namelist())

def get_png(name):
    path = JARPREFIX + name + '.png'
    if path in have:
        return Image.open(z.open(path)).convert('RGBA')
    # 特殊回退
    alt = {
        'decorated_pot': 'cyan_terracotta',
        'weathered_copper_grate': 'weathered_copper',
        'cartography_table_side3': 'oak_planks',
        'loom_side': 'oak_planks',
        'loom_top': 'oak_planks',
        'cake_top': 'cake_side',
        'cake_bottom': 'cake_side',
        'scaffolding_bottom': 'scaffolding_side',
        'tripwire_hook': 'iron_bars',
        'stripped_warped_stem': 'warped_stem',
        'stripped_warped_stem_top': 'warped_stem_top',
    }
    if name in alt and JARPREFIX + alt[name] + '.png' in have:
        return Image.open(z.open(JARPREFIX + alt[name] + '.png')).convert('RGBA')
    return None

tex_imgs = {}
missing = []
for name in sorted(needed):
    img = get_png(name)
    if img is None:
        missing.append(name)
        continue
    tex_imgs[name] = img

# ---------- 打包图集 ----------
names = sorted(tex_imgs.keys())
W = 16
# 行数
cols = 32
rows = (len(names) + cols - 1) // cols
atlas_w = cols * W
atlas_h = rows * W
atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
uvs = {}
for idx, name in enumerate(names):
    r, c = divmod(idx, cols)
    img = tex_imgs[name]
    atlas.paste(img, (c*W, r*W))
    u0 = c*W / atlas_w; v0 = r*W / atlas_h
    u1 = (c*W + img.width) / atlas_w; v1 = (r*W + img.height) / atlas_h
    uvs[name] = [round(u0,5), round(v0,5), round(u1,5), round(v1,5)]

atlas.save(os.path.join(OUT, 'atlas.png'))
out_json = {
    "atlas_size": [atlas_w, atlas_h],
    "uvs": uvs,
    "blocks": BLOCK_TEX,
    "missing_textures": missing,
}
with open(os.path.join(OUT, 'atlas.json'), 'w', encoding='utf-8') as f:
    json.dump(out_json, f, ensure_ascii=False)

print("图集尺寸:", atlas_w, 'x', atlas_h, " 纹理数:", len(names))
print("缺失纹理:", missing if missing else "(无)")
print("已写入 atlas.png / atlas.json")
