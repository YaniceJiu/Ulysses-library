/** 世界总调度：场景/天空/光照/地面/建筑/玩家/物件/动画循环 */
import * as THREE from 'three';
import { store, restorePos, rememberPos } from '../store';
import { net } from '../net';
import { api } from '../api';
import { Building } from './Building';
import { PlayerController } from './Player';
import { ObjectsManager } from './Objects3D';
import { PinsManager } from './Pins';
import { makeAvatar } from './Avatar';

export class World {
  constructor(container) {
    this.container = container;
    this.keys = {};
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 280, 520);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 900);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    // 色彩舒适化：ACES 色调映射——柔和高光（白色不过曝）、提亮暗部（红色不发黑）
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();

    // 灯光（白天）：暖阳 + 高环境光，白不刺眼、红不发黑
    this.scene.add(new THREE.HemisphereLight(0xd6e6ff, 0xb9c2ad, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.68);
    sun.position.set(120, 180, 90);
    sun.castShadow = true;
    this.scene.add(sun);

    // 地面
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshLambertMaterial({ color: 0x7cb56b })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.groundMat = this.ground.material;   // 记录原始地面材质（幽灵模式要换掉）

    // 建筑
    this.building = new Building(this.scene);
    this.building.load(() => {});

    // 玩家/物件
    this.player = new PlayerController(this, this.renderer.domElement);
    this.objects = new ObjectsManager(this);
    this.pins = new PinsManager(this);

    // 调试钩子
    window.__THREE = THREE;

    this.avatars = new Map(); // playerId -> group
    this.moveTarget = null;   // 正在搬动的物件数据
    this.clock = new THREE.Clock();

    this._onResize();
    window.addEventListener('resize', this._onResize.bind(this));
    this._bindClick();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (store.placingPin) store.placingPin = false;
        if (store.movingPin) store.movingPin = null;
      }
    });

    // 首次位置（重进保留位置）
    restorePos();
    store.playerPos.y = this.player.groundYAt(store.playerPos.x, store.playerPos.z, store.playerPos.y + 2);

    this._loop();
  }

  isBusy() {
    return store.showPhoto || store.showBoard || store.selectedPin || store.placingPin || store.movingPin;
  }

  _onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _bindClick() {
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (store.showPhoto || store.showBoard) return;
      if (store.placingPin || store.movingPin) {
        const point = this.pins.placePoint();
        if (!point) {
          store.error = '请将准星对准图书馆可行走的楼面再点击。';
          return;
        }
        store.error = '';
        const task = store.placingPin
          ? api.createPin(point)
          : api.movePin(store.movingPin, point);
        task.then((pin) => {
          const index = store.pins.findIndex((item) => item.id === pin.id);
          if (index < 0) store.pins.push(pin);
          else store.pins[index] = pin;
          store.placingPin = false;
          store.movingPin = null;
        }).catch((error) => { store.error = error.message; });
        return;
      }
      this.pins.pick();
    });
  }

  requestPointerLock() {
    const dom = this.renderer.domElement;
    if (dom && dom.requestPointerLock) { try { dom.requestPointerLock(); } catch (e) {} }
  }

  dropMoving() {
    const obj = store.selectedObject;
    if (!obj || !store.movingObject) { store.movingObject = false; return; }
    const pos = this.objects._frontPos();
    const y = this.player.groundYAt(pos.x, pos.z, store.playerPos.y + 2);
    api.moveObject(obj.id, { actor: store.playerId, x: pos.x, y, z: pos.z, rotY: obj.rotY, scale: obj.scale })
      .catch(() => {});
    store.movingObject = false;
    store.selectedObject = null;   // 放好后清空选中，不再弹菜单
  }

  startMove(obj) {
    store.selectedObject = obj;
    store.movingObject = true;
    this._relock();                // 搬动：锁定鼠标控制朝向/位置
  }

  cancelMove() {
    store.movingObject = false;
    store.selectedObject = null;
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.player.update(dt);
    this._syncAvatars();
    this.objects.sync();
    this.pins.sync();
    this.objects.updatePlaceGhost();   // 放置幽灵跟随准星
    this.objects.moveGhost(dt);        // 搬动跟随（无则不动作）

    this.renderer.render(this.scene, this.camera);
    net.sendMove();
  }

  // 其他玩家的方块人
  _syncAvatars() {
    const ids = new Set();
    for (const p of store.players) {
      if (p.id === store.playerId) continue;
      ids.add(p.id);
      let av = this.avatars.get(p.id);
      if (!av) {
        av = makeAvatar(p.name, p.color);
        this.scene.add(av);
        this.avatars.set(p.id, av);
      }
      av.position.set(p.x, p.y, p.z);
      av.rotation.y = (p.yaw * Math.PI) / 180;
    }
    for (const [id, av] of this.avatars) {
      if (!ids.has(id)) { this.scene.remove(av); this.avatars.delete(id); }
    }
  }

  setGhost(on) {
    // 建筑：半透明淡灰、去贴图/颜色/发光（含发光方块）
    this.building.toggleGhost(on);
    // 地面：幽灵模式换无光照的均匀灰材质（避免灯光把它打亮成白色）
    if (on) {
      if (!this._ghostGroundMat) {
        this._ghostGroundMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a6, transparent: true, opacity: 0.18, depthWrite: false });
      }
      this.ground.material = this._ghostGroundMat;
    } else {
      this.ground.material = this.groundMat;
    }
    // 天空/雾：变暗灰，只凸显上传物件
    this.scene.background = new THREE.Color(on ? 0x2b2b2e : 0x87ceeb);
    this.scene.fog.color.setHex(on ? 0x2b2b2e : 0x87ceeb);
    this.scene.fog.near = on ? 60 : 280;
    this.scene.fog.far = on ? 200 : 520;
  }
}
