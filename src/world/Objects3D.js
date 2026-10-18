/** 上传物件：GLB 加载/自动缩放/放置/搬动/点击选中/勾选可见性/幽灵下仍可见 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { store, visibleOwner } from '../store';
import { api } from '../api';

export class ObjectsManager {
  constructor(world) {
    this.world = world;          // scene、camera、building、raycaster
    this.loader = new GLTFLoader();
    this.cache = new Map();      // url -> Promise<THREE.Group>
    this.entries = new Map();    // objectId -> { group, data, visible, bottom }
    this.group = new THREE.Group();
    world.scene.add(this.group);

    // 放置幽灵（准星跟随）
    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;
    world.scene.add(this.ghostGroup);
    this._ghostModel = null;
    this._ghostBottom = 0;
    this._placePoint = null;
  }

  load(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, new Promise((res, rej) => {
        this.loader.load(url, (gltf) => res(gltf.scene), undefined, (e) => rej(e));
      }));
    }
    return this.cache.get(url);
  }

  // 根据 store.objects 同步渲染（勾选过滤 + 幽灵模式仍显示）
  sync() {
    const seen = new Set();
    for (const obj of store.objects) {
      seen.add(obj.id);
      const shouldShow = visibleOwner(obj.owner);
      let e = this.entries.get(obj.id);
      if (!e) {
        e = { group: new THREE.Group(), data: null, visible: false, bottom: 0 };
        this.entries.set(obj.id, e);
        this.group.add(e.group);
      }
      if (e.data !== obj) {
        e.data = obj;
        this._apply(e, obj);
      } else if (e.visible !== shouldShow) {
        e.group.visible = shouldShow;
        e.visible = shouldShow;
      }
    }
    // 移除不存在的
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        this.group.remove(e.group);
        this.entries.delete(id);
      }
    }
  }

  async _apply(e, obj) {
    try {
      const model = await this.load(obj.url);
      // 清空旧的
      while (e.group.children.length) e.group.remove(e.group.children[0]);
      const clone = model.clone(true);
      clone.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      e.group.add(clone);
      this._placeGroup(e.group, obj);
      e.group.visible = visibleOwner(obj.owner);
      e.visible = visibleOwner(obj.owner);
    } catch (err) {
      e.group.visible = false;
    }
  }

  _placeGroup(g, obj) {
    g.position.set(obj.x, obj.y, obj.z);
    g.rotation.y = (obj.rotY || 0) * Math.PI / 180;
    g.scale.setScalar(obj.scale || 1);
  }

  // 弹窗里调大小/旋转后，实时刷新 3D 显示
  refreshTransform(obj) {
    const e = this.entries.get(obj.id);
    if (e && e.group) this._placeGroup(e.group, obj);
  }

  // 点击选中（从相机中心射线）
  pick() {
    const cam = this.world.camera;
    const c = this.world.raycaster;
    c.setFromCamera({ x: 0, y: 0 }, cam);
    let best = null, bestD = Infinity;
    for (const [, e] of this.entries) {
      if (!e.group.visible) continue;
      const hits = c.intersectObject(e.group, true);
      if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = e; }
    }
    if (best) {
      store.selectedObject = best.data;
      // 弹菜单：松开鼠标锁，让光标能点面板/滑块
      if (document.pointerLockElement) document.exitPointerLock();
    }
    return best ? best.data : null;
  }

  // ================= 准星放置（贴地） =================
  // 准星（相机中心）射线与“玩家所在高度”水平面的交点 = 放置点（只能贴该层地面）
  computePlacePoint() {
    const ray = this.world.raycaster;
    ray.setFromCamera({ x: 0, y: 0 }, this.world.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const planeY = store.playerPos.y;             // 贴玩家所在层的地面
    if (Math.abs(d.y) < 0.0001) return null;      // 平视/朝天放不了
    const t = (planeY - o.y) / d.y;
    if (t < 0.5 || t > 40) return null;           // 太近/太远
    const x = o.x + d.x * t;
    const z = o.z + d.z * t;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x, y: planeY, z };
  }

  // 放置幽灵跟随准星（每帧调用；仅在“放置阶段”显示）
  async updatePlaceGhost() {
    const p = store.placing;
    if (!p || p.phase !== 'place') { this.ghostGroup.visible = false; return; }
    const pt = this.computePlacePoint();
    if (!pt) { this.ghostGroup.visible = false; return; }
    if (!this._ghostModel) {
      if (this._ghostLoading) return;               // 已在加载，等下一帧（防并发重复添加）
      this._ghostLoading = true;
      try {
        const model = await this.load(p.url);
        if (store.placing !== p) { this._ghostLoading = false; return; } // 已取消
        this._ghostModel = model.clone(true);
        this._ghostModel.traverse((m) => {
          if (m.isMesh && m.material) {
            m.material = m.material.clone();
            m.material.transparent = true;
            m.material.opacity = 0.6;
            m.material.depthWrite = false;
          }
        });
        const box = new THREE.Box3().setFromObject(this._ghostModel);
        this._ghostBottom = box.min.y;
        while (this.ghostGroup.children.length) this.ghostGroup.remove(this.ghostGroup.children[0]); // 防残留
        this.ghostGroup.add(this._ghostModel);
      } catch (e) { this._ghostLoading = false; return; }
      this._ghostLoading = false;
    }
    this.ghostGroup.visible = true;
    this.ghostGroup.position.set(pt.x, pt.y - this._ghostBottom * (p.scale || 1), pt.z);
    this.ghostGroup.rotation.y = (p.rotY || 0) * Math.PI / 180;
    this.ghostGroup.scale.setScalar(p.scale || 1);
    this._placePoint = pt;
  }

  // 点击放置：落到准星所指地面
  async placeGhost() {
    const p = store.placing;
    if (!p) return null;
    const pt = (this._placePoint && Number.isFinite(this._placePoint.x)) ? this._placePoint : this.computePlacePoint();
    if (!pt) return null;
    const obj = {
      name: p.name || '新物件',
      url: p.url, x: pt.x, y: pt.y, z: pt.z, rotY: p.rotY || 0, scale: p.scale || 1,
      owner: store.playerId, ownerName: store.name, room: store.room,
    };
    const saved = await api.placeObject(obj);
    // 清理幽灵（移除模型，避免下次叠加）
    if (this._ghostModel) this.ghostGroup.remove(this._ghostModel);
    this.ghostGroup.visible = false;
    this._ghostModel = null;
    store.placing = null;
    return saved;
  }

  cancelGhost() {
    if (this._ghostModel) this.ghostGroup.remove(this._ghostModel);
    this.ghostGroup.visible = false;
    this._ghostModel = null;
    store.placing = null;
  }

  // 搬动：跟随相机前方，点击落下
  moveGhost(dt) {
    const obj = store.selectedObject;
    if (!obj) return;
    const pos = this._frontPos();
    const y = this.world.player.groundYAt(pos.x, pos.z, store.playerPos.y + 2);
    const e = this.entries.get(obj.id);
    if (e) {
      const bottom = (e.bottom || 0) * (obj.scale || 1);
      e.group.position.set(pos.x, y - bottom, pos.z);
    }
    return { x: pos.x, y, z: pos.z };
  }

  _frontPos(dist = 3) {
    const p = store.playerPos;
    const yaw = (p.yaw * Math.PI) / 180;
    return { x: p.x - Math.sin(yaw) * dist, z: p.z - Math.cos(yaw) * dist };
  }
}
