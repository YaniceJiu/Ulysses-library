/* 方块建模系统：根据方块 id + 属性生成正确的 3D 形状和纹理 UV */
'use strict';

// 方块面朝向
const PX=0, NX=1, PY=2, NY=3, PZ=4, NZ=5;
const FACE_NORMALS = [
  [ 1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
];
// Minecraft 式逐面亮度
const FACE_BRIGHT = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];

// 每种方块形状生成器返回：{ boxes: [{min,max,faces(role),color?,emissive?}], opaque: bool, full: bool }
// faces 角色: py/nx/px/nz/pz/ny -> 纹理角色名

function cube() { return { full:true, opaque:true, boxes:[{min:[0,0,0],max:[1,1,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] }; }

// ================= 楼梯（基于原版模型 JSON + 旋转表，16 格坐标） =================
const STAIR_STRAIGHT = [
  {from:[0,0,0],to:[16,8,16]},
  {from:[8,8,0],to:[16,16,16]},
];
const STAIR_INNER = [
  {from:[0,0,0],to:[16,8,16]},
  {from:[8,8,0],to:[16,16,16]},
  {from:[0,8,8],to:[8,16,16]},
];
const STAIR_OUTER = [
  {from:[0,0,0],to:[16,8,16]},
  {from:[8,8,8],to:[16,16,16]},
];
// 旋转（原版约定：y 绕竖轴，x180 翻转上下）
function rotYBox(b, deg){
  const f=b.from, t=b.to;
  switch(deg){
    case 0:   return {from:[f[0],f[1],f[2]], to:[t[0],t[1],t[2]]};
    case 90:  return {from:[16-t[2],f[1],f[0]], to:[16-f[2],t[1],t[0]]};
    case 180: return {from:[16-t[0],f[1],16-t[2]], to:[16-f[0],t[1],16-f[2]]};
    case 270: return {from:[f[2],f[1],16-t[0]], to:[t[2],t[1],16-f[0]]};
  }
}
function rotXBox(b){
  return {from:[b.from[0],16-b.to[1],16-b.to[2]], to:[b.to[0],16-b.from[1],16-b.from[2]]};
}
function makeStairs(facing, half, shape){
  const straightY = {east:0, south:90, west:180, north:270}[facing] ?? 270;
  const top = half === 'top';
  let base, y;
  if (shape === 'straight')           { base = STAIR_STRAIGHT; y = straightY; }
  else if (shape === 'inner_left')    { base = STAIR_INNER;    y = top ? straightY : (straightY+270)%360; }
  else if (shape === 'inner_right')   { base = STAIR_INNER;    y = top ? (straightY+90)%360 : straightY; }
  else if (shape === 'outer_left')    { base = STAIR_OUTER;    y = top ? straightY : (straightY+270)%360; }
  else if (shape === 'outer_right')   { base = STAIR_OUTER;    y = top ? (straightY+90)%360 : straightY; }
  else                                { base = STAIR_STRAIGHT; y = straightY; }
  const boxes = [];
  for (const e of base){
    let b = e;
    if (top) b = rotXBox(b);   // 先 x180
    b = rotYBox(b, y);         // 再 y
    boxes.push({
      min:[b.from[0]/16, b.from[1]/16, b.from[2]/16],
      max:[b.to[0]/16,   b.to[1]/16,   b.to[2]/16],
      f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}
    });
  }
  return { full:false, opaque:true, boxes };
}

function shape(bid, p, nb) {
  // 非实心（需要特殊形状）的方块集合
  const t = (k) => (p[k]==='true');
  switch (bid) {
    case 'glass': return { full:true, opaque:false, boxes:[{min:[0,0,0],max:[1,1,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    // ---- 台阶 ----
    case 'acacia_slab': case 'oak_slab': case 'quartz_slab': case 'smooth_quartz_slab':
    case 'polished_blackstone_brick_slab': case 'cut_sandstone_slab': case 'polished_tuff_slab':
    case 'purpur_slab': {
      const type = p['type'] || 'bottom';
      if (type === 'double') return cube();
      const y = type === 'top' ? 0.5 : 0;
      return { full:false, opaque:true, boxes:[{min:[0,y,0],max:[1,y+0.5,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 楼梯（原版模型，含上下半/内转角/外转角）----
    case 'mangrove_stairs': case 'oak_stairs': case 'spruce_stairs': case 'dark_oak_stairs':
    case 'acacia_stairs': case 'quartz_stairs': case 'smooth_quartz_stairs':
    case 'cinnabar_brick_stairs': case 'prismarine_brick_stairs': {
      return makeStairs(p['facing']||'north', p['half']||'bottom', p['shape']||'straight');
    }
    // ---- 栅栏 ----
    case 'spruce_fence': case 'dark_oak_fence': case 'acacia_fence': case 'oak_fence':
    case 'cherry_fence': case 'mangrove_fence': {
      const boxes = [{min:[0.375,0,0.375],max:[0.625,1,0.625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}];
      if (t(p['north'])) boxes.push({min:[0.375,0.375,0],max:[0.625,0.625,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      if (t(p['south'])) boxes.push({min:[0.375,0.375,0],max:[0.625,0.625,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      if (t(p['east']))  boxes.push({min:[0,0.375,0.375],max:[1,0.625,0.625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      if (t(p['west']))  boxes.push({min:[0,0.375,0.375],max:[1,0.625,0.625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      return { full:false, opaque:true, boxes };
    }
    // ---- 墙 ----
    case 'red_nether_brick_wall': case 'blackstone_wall': case 'mud_brick_wall': {
      const boxes = [{min:[0.25,0,0.25],max:[0.75,1,0.75],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}];
      const sideH = (d) => p[d]==='low' ? 0.5 : (p[d]==='tall' ? 0.75 : 0);
      const hN=sideH('north'), hS=sideH('south'), hE=sideH('east'), hW=sideH('west');
      if (hN>0||hS>0) boxes.push({min:[0.25,0,0],max:[0.75,Math.max(hN,hS),1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      if (hE>0||hW>0) boxes.push({min:[0,0,0.25],max:[1,Math.max(hE,hW),0.75],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      return { full:false, opaque:true, boxes };
    }
    // ---- 玻璃板 / 铁栏杆 ----
    case 'glass_pane': case 'black_stained_glass_pane': case 'gray_stained_glass_pane':
    case 'light_gray_stained_glass_pane': case 'iron_bars': case 'exposed_copper_bars':
    case 'weathered_copper_bars': {
      const boxes = [{min:[0.4375,0,0.4375],max:[0.5625,1,0.5625],f:{px:'side',nx:'side',py:'top',ny:'top',pz:'side',nz:'side'}}];
      if (t(p['north'])||t(p['south'])) boxes.push({min:[0.4375,0,0],max:[0.5625,1,1],f:{px:'side',nx:'side',py:'top',ny:'top',pz:'side',nz:'side'}});
      if (t(p['east'])||t(p['west']))   boxes.push({min:[0,0,0.4375],max:[1,1,0.5625],f:{px:'side',nx:'side',py:'top',ny:'top',pz:'side',nz:'side'}});
      return { full:false, opaque:false, boxes };
    }
    // ---- 门 ----
    case 'pale_oak_door': {
      const facing = p['facing']||'north';
      const half = p['half']||'lower';
      const thick = 0.1875;
      let box;
      if (facing==='north'||facing==='south') box={min:[0,0,0.5-thick/2],max:[1,1,0.5+thick/2]};
      else box={min:[0.5-thick/2,0,0],max:[0.5+thick/2,1,1]};
      const role = half==='upper' ? 'top' : 'bottom';
      return { full:false, opaque:true, boxes:[{min:box.min,max:box.max,f:{px:role,nx:role,py:role,ny:role,pz:role,nz:role}}] };
    }
    // ---- 活板门 ----
    case 'mangrove_trapdoor': case 'spruce_trapdoor': {
      const half = p['half']||'bottom';
      const y = half==='top' ? 0.8125 : 0;
      return { full:false, opaque:true, boxes:[{min:[0,y,0],max:[1,y+0.1875,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 地毯 ----
    case 'blue_carpet': case 'gray_carpet': case 'light_blue_carpet': case 'green_carpet':
    case 'yellow_carpet': case 'black_carpet': case 'cyan_carpet': case 'lime_carpet':
    case 'orange_carpet': case 'light_gray_carpet': case 'red_carpet': case 'white_carpet': {
      return { full:false, opaque:true, boxes:[{min:[0,0,0],max:[1,0.0625,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 火把 ----
    case 'torch': return { full:false, opaque:true, boxes:[{min:[0.4375,0,0.4375],max:[0.5625,0.625,0.5625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    case 'wall_torch': case 'soul_wall_torch': {
      const facing = p['facing']||'north';
      const m = { north:{min:[0.4375,0.4375,0.375],max:[0.5625,0.625,0.875]},
                  south:{min:[0.4375,0.4375,0.125],max:[0.5625,0.625,0.625]},
                  west:{min:[0.375,0.4375,0.4375],max:[0.875,0.625,0.5625]},
                  east:{min:[0.125,0.4375,0.4375],max:[0.625,0.625,0.5625]} }[facing];
      return { full:false, opaque:true, boxes:[{min:m.min,max:m.max,f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 灯笼 ----
    case 'lantern': {
      const hang = p['hanging']==='true';
      const b = hang ? {min:[0.3125,0.25,0.3125],max:[0.6875,1,0.6875]} : {min:[0.3125,0.125,0.3125],max:[0.6875,0.8125,0.6875]};
      const boxes = [{min:b.min,max:b.max,f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'},emissive:true}];
      if (hang) boxes.push({min:[0.46875,0,0.46875],max:[0.53125,0.25,0.53125],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}});
      return { full:false, opaque:true, boxes };
    }
    // ---- 末地烛 ----
    case 'end_rod': {
      const facing = p['facing']||'up';
      let box;
      if (facing==='up'||facing==='down') box={min:[0.375,0,0.375],max:[0.625,1,0.625]};
      else if (facing==='north'||facing==='south') box={min:[0.375,0.375,0],max:[0.625,0.625,1]};
      else box={min:[0,0.375,0.375],max:[1,0.625,0.625]};
      return { full:false, opaque:true, boxes:[{min:box.min,max:box.max,f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 锁链 ----
    case 'iron_chain': case 'oxidized_copper_chain': {
      const axis = p['axis']||'y';
      let box = axis==='y' ? {min:[0.4375,0,0.4375],max:[0.5625,1,0.5625]}
              : axis==='x' ? {min:[0,0.4375,0.4375],max:[1,0.5625,0.5625]}
              : {min:[0.4375,0.4375,0],max:[0.5625,0.5625,1]};
      return { full:false, opaque:true, boxes:[{min:box.min,max:box.max,f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 骷髅头（无材质，用颜色）----
    case 'wither_skeleton_skull': {
      return { full:false, opaque:true, boxes:[{min:[0.25,0,0.25],max:[0.75,0.5,0.75],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'},color:[45,45,48]}] };
    }
    // ---- 蜡烛 ----
    case 'white_candle': case 'red_candle': case 'candle': {
      return { full:false, opaque:true, boxes:[{min:[0.375,0,0.375],max:[0.625,0.5,0.625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 压力板 ----
    case 'oak_pressure_plate': case 'mangrove_pressure_plate': case 'spruce_pressure_plate':
    case 'pale_oak_pressure_plate': {
      return { full:false, opaque:true, boxes:[{min:[0.0625,0,0.0625],max:[0.9375,0.0625,0.9375],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 蛋糕 ----
    case 'cake': {
      return { full:false, opaque:true, boxes:[{min:[0.0625,0,0.0625],max:[0.9375,0.5,0.9375],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 讲台 ----
    case 'lectern': {
      return { full:false, opaque:true, boxes:[
        {min:[0,0,0],max:[1,0.125,1],f:{px:'sides',nx:'sides',py:'top',ny:'base',pz:'sides',nz:'sides'}},
        {min:[0.125,0.125,0.125],max:[0.875,0.75,0.875],f:{px:'sides',nx:'sides',py:'top',ny:'base',pz:'front',nz:'sides'}},
        {min:[0.125,0.75,0.125],max:[0.875,0.875,0.875],f:{px:'sides',nx:'sides',py:'top',ny:'base',pz:'front',nz:'sides'}},
      ]};
    }
    // ---- 脚手架 ----
    case 'scaffolding': {
      return { full:false, opaque:false, boxes:[
        {min:[0.125,0,0.125],max:[0.875,1,0.875],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}},
        {min:[0,0,0.4375],max:[1,0.125,0.5625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}},
      ]};
    }
    // ---- 树苗/杜鹃叶（十字形）----
    case 'oak_sapling': case 'flowering_azalea_leaves': {
      return { full:false, opaque:false, cross:true, boxes:[
        {min:[0.4375,0,0],max:[0.5625,1,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}},
        {min:[0,0,0.4375],max:[1,1,0.5625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}},
      ]};
    }
    // ---- 横幅/悬挂牌（薄板）----
    case 'light_blue_wall_banner': case 'lime_wall_banner': case 'white_wall_banner': {
      const col = {light_blue_wall_banner:[110,170,230],lime_wall_banner:[120,200,60],white_wall_banner:[232,232,232]}[bid];
      return { full:false, opaque:true, boxes:[{min:[0.4375,0,0],max:[0.5625,1,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'},color:col}] };
    }
    case 'warped_wall_hanging_sign': case 'mangrove_wall_hanging_sign': case 'crimson_hanging_sign':
    case 'warped_hanging_sign': {
      return { full:false, opaque:true, boxes:[{min:[0,0.875,0.4375],max:[1,0.9375,0.5625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 装饰陶罐 ----
    case 'decorated_pot': {
      return { full:false, opaque:true, boxes:[{min:[0.1875,0,0.1875],max:[0.8125,0.625,0.8125],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 结构方块（半透明）----
    case 'structure_block': {
      return { full:true, opaque:false, boxes:[{min:[0,0,0],max:[1,1,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'},color:[200,120,40]}] };
    }
    // ---- 营火 ----
    case 'campfire': {
      return { full:false, opaque:true, boxes:[
        {min:[0,0,0],max:[1,0.375,1],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}},
      ]};
    }
    // ---- 避雷针 ----
    case 'exposed_lightning_rod': case 'weathered_lightning_rod': case 'oxidized_lightning_rod': {
      const facing = p['facing']||'up';
      let box = facing==='up'||facing==='down' ? {min:[0.4375,0,0.4375],max:[0.5625,1,0.5625]}
              : facing==='north'||facing==='south' ? {min:[0.4375,0.4375,0],max:[0.5625,0.5625,1]}
              : {min:[0,0.4375,0.4375],max:[1,0.5625,0.5625]};
      return { full:false, opaque:true, boxes:[{min:box.min,max:box.max,f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    // ---- 绊线钩 / 其他小物 ----
    case 'tripwire_hook': {
      return { full:false, opaque:true, boxes:[{min:[0.375,0.3125,0.375],max:[0.625,0.625,0.625],f:{px:'side',nx:'side',py:'top',ny:'bottom',pz:'side',nz:'side'}}] };
    }
    default:
      return cube();
  }
}

// 哪些方块是"不透明实心立方体"（用于面剔除）
const NOT_FULL = new Set([
  'glass','acacia_slab','oak_slab','quartz_slab','smooth_quartz_slab','polished_blackstone_brick_slab',
  'cut_sandstone_slab','polished_tuff_slab','purpur_slab','mangrove_stairs','oak_stairs','spruce_stairs',
  'dark_oak_stairs','acacia_stairs','quartz_stairs','smooth_quartz_stairs','cinnabar_brick_stairs',
  'prismarine_brick_stairs','spruce_fence','dark_oak_fence','acacia_fence','oak_fence','cherry_fence',
  'mangrove_fence','red_nether_brick_wall','blackstone_wall','mud_brick_wall','glass_pane',
  'black_stained_glass_pane','gray_stained_glass_pane','light_gray_stained_glass_pane','iron_bars',
  'exposed_copper_bars','weathered_copper_bars','pale_oak_door','mangrove_trapdoor','spruce_trapdoor',
  'blue_carpet','gray_carpet','light_blue_carpet','green_carpet','yellow_carpet','black_carpet',
  'cyan_carpet','lime_carpet','orange_carpet','light_gray_carpet','red_carpet','white_carpet',
  'torch','wall_torch','soul_wall_torch','lantern','end_rod','iron_chain','oxidized_copper_chain',
  'wither_skeleton_skull','white_candle','red_candle','candle','oak_pressure_plate',
  'mangrove_pressure_plate','spruce_pressure_plate','pale_oak_pressure_plate','cake','lectern',
  'scaffolding','oak_sapling','flowering_azalea_leaves','light_blue_wall_banner','lime_wall_banner',
  'white_wall_banner','warped_wall_hanging_sign','mangrove_wall_hanging_sign','crimson_hanging_sign',
  'warped_hanging_sign','decorated_pot','campfire','exposed_lightning_rod','weathered_lightning_rod',
  'oxidized_lightning_rod','tripwire_hook','structure_block',
]);

// 透明方块（需要半透明/双面渲染）
const TRANSPARENT = new Set([
  'glass','glass_pane','black_stained_glass_pane','gray_stained_glass_pane','light_gray_stained_glass_pane',
  'iron_bars','exposed_copper_bars','weathered_copper_bars','scaffolding','oak_sapling',
  'flowering_azalea_leaves','structure_block','slime_block',
]);

window.MCBuilder = {
  NOT_FULL, TRANSPARENT,
  shape, FACE_NORMALS, FACE_BRIGHT,
};
