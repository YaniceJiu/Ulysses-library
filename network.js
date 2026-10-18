/* 多人网络：socket.io 同步 + 玩家头像 + 3D 物件加载 */
'use strict';

class Network {
  constructor(scene, onReady) {
    this.scene = scene;
    this.socket = io();
    this.avatars = new Map();   // socketId -> THREE.Group
    this.objMeshes = new Map(); // objId -> THREE.Group
    this.localId = null;
    this.name = '';
    this.gltfLoader = new THREE.GLTFLoader();
    this.onReady = onReady || (()=>{});

    this.socket.on('state', (s) => {
      for (const [id, p] of Object.entries(s.players)) {
        if (id !== this.localId) this.spawnAvatar(id, p);
      }
      for (const obj of s.objects) this.placeObject(obj);
      this.onReady(s);
    });
    this.socket.on('player-joined', ({id, ...p}) => { if (id!==this.localId) this.spawnAvatar(id, p); });
    this.socket.on('player-move', ({id, ...p}) => { this.updateAvatar(id, p); });
    this.socket.on('player-left', ({id}) => this.removeAvatar(id));
    this.socket.on('object-added', (obj) => this.placeObject(obj));
  }

  join(name, pos) {
    this.name = name;
    this.socket.emit('join', { name, x: pos[0], y: pos[1], z: pos[2] });
    this.socket.on('connect', () => {});
    this.socket.on('disconnect', () => console.log('已断开连接'));
  }

  sendMove(p) {
    this.socket.emit('move', { x: p[0], y: p[1], z: p[2], yaw: this._localYaw, pitch: this._localPitch });
  }

  setLocal(id, yaw, pitch) { this.localId = id; this._localYaw = yaw; this._localPitch = pitch; }

  // ---- 其他玩家头像 ----
  spawnAvatar(id, p) {
    const g = new THREE.Group();
    const col = p.color || '#ff6b6b';
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x222222 });
    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshLambertMaterial({ color: 0xf1c27d }));
    head.position.y = 1.75;
    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.7,0.3), mat);
    body.position.y = 1.15;
    // 腿
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.7,0.25), mat2); legL.position.set(-0.15,0.35,0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.7,0.25), mat2); legR.position.set(0.15,0.35,0);
    // 手臂
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.7,0.18), mat); armL.position.set(-0.42,1.15,0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.7,0.18), mat); armR.position.set(0.42,1.15,0);
    g.add(head, body, legL, legR, armL, armR);
    // 名字
    const label = this.makeLabel(p.name || '玩家');
    label.position.y = 2.35;
    g.add(label);
    this.scene.add(g);
    this.avatars.set(id, { group: g, head });
    this.updateAvatar(id, p);
  }

  updateAvatar(id, p) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.group.position.set(p.x, p.y, p.z);
    a.group.rotation.y = p.yaw || 0;
    if (a.head && p.pitch !== undefined) a.head.rotation.x = p.pitch;
  }

  removeAvatar(id) {
    const a = this.avatars.get(id);
    if (a) { this.scene.remove(a.group); this.avatars.delete(id); }
  }

  makeLabel(text) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(8, 8, 240, 48, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(2.2, 0.55, 1);
    return sp;
  }

  // ---- 上传/放置物件 ----
  placeObject(obj) {
    if (this.objMeshes.has(obj.id)) return;
    this.gltfLoader.load(obj.url, (gltf) => {
      const g = gltf.scene;
      // 归一化缩放：最大边约 2 格
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = (obj.scale || 1) * (2 / maxDim);
      g.scale.setScalar(s);
      // 底部对齐
      const b2 = new THREE.Box3().setFromObject(g);
      const h = b2.getSize(new THREE.Vector3()).y;
      g.position.set(obj.x, obj.y + h/2, obj.z);
      g.rotation.y = obj.rotY || 0;
      g.traverse(c => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; } });
      this.scene.add(g);
      this.objMeshes.set(obj.id, g);
    }, undefined, (err) => console.error('加载物件失败:', obj.url, err));
  }

  // 上传并放置
  uploadAndPlace(file, pos, cb) {
    const fd = new FormData();
    fd.append('file', file);
    fetch('/upload', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(json => {
        if (!json.url) throw new Error('upload failed');
        const obj = { id: json.id, url: json.url, x: pos[0], y: pos[1], z: pos[2], rotY: 0, scale: 1, name: file.name };
        this.placeObject(obj);
        this.socket.emit('object', obj);
        cb && cb(obj);
      })
      .catch(e => { alert('上传失败: ' + e.message); });
  }
}

window.Network = Network;
