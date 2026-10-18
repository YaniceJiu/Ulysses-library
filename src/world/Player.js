/** 第一人称控制器：pointer-lock、WASD/跳/疾跑、重力、建筑碰撞、眼睛高度 1.5 */
import * as THREE from 'three';
import { store, rememberPos } from '../store';

const EYE = 1.5;
const WALK = 5.5;
const SPRINT = 9;
const GRAVITY = 26;
const JUMP_HEIGHT = 1.05;      // 正常模式：跳 1 格
const GHOST_JUMP_HEIGHT = 3.15; // 幽灵模式：跳 3 格（二段跳保留）
const SENS = 0.0024;

// 按当前模式（幽灵/正常）算起跳速度：h = v² / 2g
function jumpSpeed() {
  const h = store.ghost ? GHOST_JUMP_HEIGHT : JUMP_HEIGHT;
  return Math.sqrt(2 * GRAVITY * h);
}

export class PlayerController {
  constructor(world, dom) {
    this.world = world;   // 提供 camera、building.collider、keys、raycaster
    this.dom = dom;
    this.locked = false;
    this.onGround = false;
    this.velY = 0;
    this.jumps = 0;        // 二段跳计数
    this._spaceWas = false; // 空格上次按下状态（上升沿检测）
    this._ray = new THREE.Raycaster();
    this._down = new THREE.Vector3(0, -1, 0);
    this._touchPointer = null;
    this._touchPosition = null;

    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || this.locked || world.isBusy()) return;
      dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      store.locked = this.locked;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this._look(e.movementX, e.movementY);
    });
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || this.locked) return;
      this._touchPointer = e.pointerId;
      this._touchPosition = { x: e.clientX, y: e.clientY };
      try { dom.setPointerCapture(e.pointerId); } catch {}
    });
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || e.pointerId !== this._touchPointer || !this._touchPosition) return;
      const dx = e.clientX - this._touchPosition.x;
      const dy = e.clientY - this._touchPosition.y;
      this._touchPosition = { x: e.clientX, y: e.clientY };
      this._look(dx * 1.6, dy * 1.6);
      e.preventDefault();
    });
    const stopTouchLook = (e) => {
      if (e.pointerId === this._touchPointer) {
        this._touchPointer = null;
        this._touchPosition = null;
      }
    };
    dom.addEventListener('pointerup', stopTouchLook);
    dom.addEventListener('pointercancel', stopTouchLook);
    window.addEventListener('keydown', (e) => { this.world.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.world.keys[e.key.toLowerCase()] = false; });
  }

  _look(dx, dy) {
    const p = store.playerPos;
    p.yaw -= dx * SENS * 180 / Math.PI;
    p.pitch -= dy * SENS * 180 / Math.PI;
    p.pitch = Math.max(-89, Math.min(89, p.pitch));
  }

  // 脚下最近的地面高度：从 fromY 向下找最近的楼层/地面（忽略头顶的屋顶/挑檐）
  groundYAt(x, z, fromY = 80) {
    const collider = this.world.building && this.world.building.collider;
    let y = 0;
    if (collider) {
      this._ray.set(new THREE.Vector3(x, fromY, z), this._down);
      this._ray.far = 300;
      const hits = this._ray.intersectObject(collider, false);
      // 只取“射线起点下方”的最近命中面（=脚下最近的地面），绝不把头顶的屋顶当落脚点
      let best = -Infinity;
      for (const h of hits) {
        if (h.point.y < fromY - 0.01 && h.point.y > best) best = h.point.y;
      }
      if (best > -Infinity) y = Math.max(0, best);
    }
    return y;
  }

  // 两点间是否被建筑挡住（分段：脚部+腰部）
  blocked(x1, y, z1, x2, z2) {
    const c = this.world.building && this.world.building.collider;
    if (!c) return false;
    const dx = x2 - x1, dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) return false;
    for (const h of [0.35, 1.3]) {
      this._ray.set(new THREE.Vector3(x1, y + h, z1), new THREE.Vector3(dx, 0, dz).normalize());
      this._ray.far = dist + 0.45;
      const hits = this._ray.intersectObject(c, false);
      if (hits.length > 0) return true;
    }
    return false;
  }

  update(dt) {
    const p = store.playerPos;
    const k = this.world.keys;
    const fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
    const strafe = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
    const speed = (k['shift'] ? SPRINT : WALK) * dt;
    const yaw = (p.yaw * Math.PI) / 180;
    const dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
    const dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;

    // 逐轴移动 + 碰撞
    let nx = p.x, nz = p.z;
    const fx = p.x + dx * speed, fz = p.z + dz * speed;
    if (!this.blocked(p.x, p.y, p.z, fx, p.z)) nx = fx;
    if (!this.blocked(p.x, p.y, p.z, p.x, fz)) nz = fz;
    p.x = nx; p.z = nz;

    // 跳跃 + 二段跳（双击空格 = 空中再跳一次）：用按键“刚按下”触发
    const spaceDown = k[' '];
    if (spaceDown && !this._spaceWas) {
      if (this.onGround) { this.velY = jumpSpeed(); this.onGround = false; this.jumps = 1; }
      else if (this.jumps < 2) { this.velY = jumpSpeed() * 0.9; this.jumps += 1; }
    }
    this._spaceWas = spaceDown;
    this.velY -= GRAVITY * dt;
    p.y += this.velY * dt;
    // 从脚上方往下找脚下最近的地面（不把屋顶当落脚点）
    const floor = this.groundYAt(p.x, p.z, p.y + 2);
    if (p.y <= floor + 0.01) { p.y = floor; this.velY = 0; this.onGround = true; this.jumps = 0; }

    // 相机（眼睛高度 1.5）
    const cam = this.world.camera;
    cam.position.set(p.x, p.y + EYE, p.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = (p.yaw * Math.PI) / 180;
    cam.rotation.x = (p.pitch * Math.PI) / 180;

    rememberPos();
  }
}
