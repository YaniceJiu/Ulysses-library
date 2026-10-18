/* 玩家控制器：第一人称物理（重力/碰撞/上台阶/跳跃） */
'use strict';

// 可穿过（无碰撞）的方块
const PASSABLE = new Set([
  'torch','wall_torch','soul_wall_torch','lantern','end_rod','iron_chain','oxidized_copper_chain',
  'glass_pane','black_stained_glass_pane','gray_stained_glass_pane','light_gray_stained_glass_pane',
  'iron_bars','exposed_copper_bars','weathered_copper_bars','pale_oak_door',
  'blue_carpet','gray_carpet','light_blue_carpet','green_carpet','yellow_carpet','black_carpet',
  'cyan_carpet','lime_carpet','orange_carpet','light_gray_carpet','red_carpet','white_carpet',
  'oak_pressure_plate','mangrove_pressure_plate','spruce_pressure_plate','pale_oak_pressure_plate',
  'white_candle','red_candle','candle','oak_sapling','flowering_azalea_leaves',
  'light_blue_wall_banner','lime_wall_banner','white_wall_banner',
  'warped_wall_hanging_sign','mangrove_wall_hanging_sign','crimson_hanging_sign','warped_hanging_sign',
  'tripwire_hook','decorated_pot','scaffolding','cake','structure_block',
]);

// 楼梯当半格台阶处理（可走上）
const STAIRS = new Set([
  'mangrove_stairs','oak_stairs','spruce_stairs','dark_oak_stairs','acacia_stairs',
  'quartz_stairs','smooth_quartz_stairs','cinnabar_brick_stairs','prismarine_brick_stairs',
]);

function makeCollisionMap(data) {
  const { blocks, size } = data;
  const W = size[0], H = size[1], D = size[2];
  // 格子 -> 碰撞盒列表（相对该格 0..1）
  const map = new Map();
  const key = (x,y,z) => (z*H + y)*W + x;
  const solidAt = new Uint8Array(W*H*D);
  for (const b of blocks) {
    if (PASSABLE.has(b.id)) continue;
    solidAt[key(b.x,b.y,b.z)] = 1;
    if (STAIRS.has(b.id)) {
      const y0 = b.p.half === 'top' ? 0.5 : 0;
      map.set(key(b.x,b.y,b.z), [{min:[0,y0,0],max:[1,y0+0.5,1]}]);
      continue;
    }
    const s = MCBuilder.shape(b.id, b.p, null);
    if (s.full) {
      map.set(key(b.x,b.y,b.z), [{min:[0,0,0],max:[1,1,1]}]);
    } else {
      map.set(key(b.x,b.y,b.z), s.boxes.map(bx => ({min:bx.min, max:bx.max})));
    }
  }
  return { map, solidAt, W, H, D, key };
}

class PlayerController {
  constructor(camera, collision, spawn) {
    this.camera = camera;
    this.c = collision;
    this.pos = spawn.slice();        // 脚底位置
    this.yaw = 0; this.pitch = 0;
    this.vel = [0, 0, 0];
    this.onGround = false;
    this.HALF = 0.3;                 // 半宽
    this.HEIGHT = 1.8;
    this.EYE = 1.62;
    this.keys = {};
    this.sprint = false;
    this.stepH = 0.5;

    camera.rotation.order = 'YXZ';
    this.applyView();
  }

  applyView() {
    this.camera.position.set(this.pos[0], this.pos[1] + this.EYE, this.pos[2]);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getAABB() {
    return { min: [this.pos[0]-this.HALF, this.pos[1], this.pos[2]-this.HALF],
             max: [this.pos[0]+this.HALF, this.pos[1]+this.HEIGHT, this.pos[2]+this.HALF] };
  }

  // 收集与 AABB 相交的碰撞盒
  hits(A) {
    const c = this.c;
    const res = [];
    const x0 = Math.floor(A.min[0]), x1 = Math.floor(A.max[0]-1e-7);
    const y0 = Math.floor(A.min[1]), y1 = Math.floor(A.max[1]-1e-7);
    const z0 = Math.floor(A.min[2]), z1 = Math.floor(A.max[2]-1e-7);
    for (let x=x0; x<=x1; x++) for (let y=y0; y<=y1; y++) for (let z=z0; z<=z1; z++) {
      if (x<0||y<0||z<0||x>=c.W||y>=c.H||z>=c.D) continue;
      const k = c.key(x,y,z);
      const boxes = c.map.get(k);
      if (!boxes) continue;
      for (const b of boxes) {
        const cb = { min:[x+b.min[0], y+b.min[1], z+b.min[2]],
                     max:[x+b.max[0], y+b.max[1], z+b.max[2]] };
        if (A.min[0] < cb.max[0] && A.max[0] > cb.min[0] &&
            A.min[1] < cb.max[1] && A.max[1] > cb.min[1] &&
            A.min[2] < cb.max[2] && A.max[2] > cb.min[2]) res.push(cb);
      }
    }
    return res;
  }

  // 沿单轴移动；返回是否完全成功（无碰撞）
  tryMoveAxis(axis, amount) {
    if (amount === 0) return true;
    const sign = amount > 0 ? 1 : -1;
    this.pos[axis] += amount;
    const A = this.getAABB();
    const hs = this.hits(A);
    if (!hs.length) return true;
    // 沿该轴推回最近面
    if (sign > 0) {
      let nearest = -Infinity;
      for (const cb of hs) {
        if (cb.min[axis] > A.min[axis] - 1e-7 && cb.min[axis] > nearest) nearest = cb.min[axis];
      }
      if (nearest > -Infinity) this.pos[axis] = nearest - this.extent(axis, sign);
    } else {
      let nearest = Infinity;
      for (const cb of hs) {
        if (cb.max[axis] < A.max[axis] + 1e-7 && cb.max[axis] < nearest) nearest = cb.max[axis];
      }
      if (nearest < Infinity) this.pos[axis] = nearest - this.extent(axis, sign);
    }
    return false;
  }

  extent(axis, sign) {
    if (axis === 0) return sign > 0 ? this.HALF : -this.HALF;
    if (axis === 2) return sign > 0 ? this.HALF : -this.HALF;
    return sign > 0 ? this.HEIGHT : 0; // Y: 顶 extent=HEIGHT, 底 extent=0
  }

  update(dt) {
    // 输入方向
    const fwd = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? 6.2 : 4.3;
    let sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // yaw: three.js 里旋转 Y 轴，方向：-yaw 对应前进
    let vx = (fwd * (-sin) + strafe * cos) * speed;
    let vz = (fwd * (-cos) + strafe * -sin) * speed;

    // 重力
    if (!this.keys['Space']) {
      this.vel[1] -= 26 * dt;
      if (this.vel[1] < -32) this.vel[1] = -32;
    }

    // 水平移动（带跨步）
    if (!this.tryMoveAxis(0, vx * dt)) {
      const sy = this.pos[1] + this.stepH;
      const prev = this.pos[1];
      this.pos[1] = sy;
      if (this.tryMoveAxis(0, vx * dt)) { /* 跨上台阶 */ }
      else this.pos[1] = prev;
    }
    if (!this.tryMoveAxis(2, vz * dt)) {
      const sy = this.pos[1] + this.stepH;
      const prev = this.pos[1];
      this.pos[1] = sy;
      if (this.tryMoveAxis(2, vz * dt)) { /* 跨上台阶 */ }
      else this.pos[1] = prev;
    }

    // 垂直
    if (this.vel[1] !== 0) {
      const ok = this.tryMoveAxis(1, this.vel[1] * dt);
      if (!ok) {
        this.onGround = this.vel[1] < 0;
        this.vel[1] = 0;
      } else {
        this.onGround = false;
      }
    } else if (this.keys['Space'] && this.onGround) {
      this.vel[1] = 8.5;
      this.onGround = false;
    }

    this.applyView();
    return [vx, this.vel[1], vz];
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    const lim = Math.PI/2 - 0.001;
    if (this.pitch >  lim) this.pitch =  lim;
    if (this.pitch < -lim) this.pitch = -lim;
    this.applyView();
  }
}

window.PASSABLE = PASSABLE;
window.PlayerController = PlayerController;
window.makeCollisionMap = makeCollisionMap;
