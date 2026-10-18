/**
 * 主应用：express + socket.io
 * 可测试：createApp(config)，port=0 随机端口，dataDir 用临时目录，可注入 hyper3dClient
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { DataStore } = require('./store');
const { RateLimiter } = require('./ratelimit');
const { makeAuth } = require('./auth');
const { GenerationQueue } = require('./hyper3d');
const { DemoApi } = require('./demo');
const { RodinApi } = require('./rodin');
const { PinStore, MAX_PINS, ADMIN_NAME, normalizeUsername, validateUsername } = require('./pin-store');
const { createSessionAuth, cookieToken, setSessionCookie, clearSessionCookie } = require('./session');

// 简单的请求包装：返回下一个可用 socket.io 房间广播名（room 为空时用 'all'）
function roomKey(room) {
  return room || 'all';
}

// 公共物件视图（去掉内部字段，返回给前端）
function publicObject(o) {
  return {
    id: o.id, name: o.name, url: o.url,
    x: o.x, y: o.y, z: o.z, rotY: o.rotY, scale: o.scale,
    owner: o.owner, ownerName: o.ownerName, room: o.room,
    time: o.time, updatedAt: o.updatedAt,
  };
}

function createApp(config) {
  const store = new DataStore(config.dataDir);
  const pinPhotoDir = path.join(config.dataDir, 'pin-photos');
  const pinStore = new PinStore(config.dataDir, pinPhotoDir);
  const limiter = new RateLimiter();
  const auth = makeAuth(config);
  const sessions = createSessionAuth(config.authSecret);
  const legacyEnabled = config.enableLegacyFeatures === true;

  // ---- AI 生成客户端（默认：有 key 用 Rodin，否则用 Demo 演示）----
  const api = config.hyper3dApi || (config.hyper3dApiKey ? new RodinApi(config) : new DemoApi(config));
  const hyper3d = new GenerationQueue(config, api, {
    onDone: (task) => {
      // 面数上限：超了判失败，防止高模卡顿
      if (task.result && task.result.triangles > config.maxTriangles) {
        task.status = 'failed';
        task.error = '模型面数过多(' + task.result.triangles + '>上限' + config.maxTriangles + ')，请重拍';
      }
      // 照片用完即删（不保留原图）
      try { fs.unlinkSync(task.photoPath); } catch (e) {}
      store.addLog({ action: 'generate_done', taskId: task.taskId, ok: task.status === 'done', error: task.error || null });
    },
    onFailed: (task) => {
      try { fs.unlinkSync(task.photoPath); } catch (e) {}
      store.addLog({ action: 'generate_fail', taskId: task.taskId, error: task.error || null });
    },
  });

  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(express.json({ limit: '1mb' }));
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] } });

  function requestUser(req) {
    const cookieUser = sessions.read(cookieToken(req.headers.cookie));
    if (cookieUser) return cookieUser;
    if (legacyEnabled && auth.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim())) {
      return { id: 'admin', username: ADMIN_NAME, role: 'admin' };
    }
    return null;
  }

  function requireUser(req, res, next) {
    req.user = requestUser(req);
    if (!req.user) return res.status(401).json({ error: '请先登录' });
    next();
  }

  function requireAdmin(req, res, next) {
    req.user = requestUser(req);
    if (!req.user || req.user.role !== 'admin') return res.status(401).json({ error: '需要管理员登录' });
    next();
  }

  function issueCookie(res, req, user) {
    setSessionCookie(res, sessions.issue(user), Boolean(req.secure || process.env.NODE_ENV === 'production'));
  }

  function pinPosition(body) {
    const x = Number(body && body.x), y = Number(body && body.y), z = Number(body && body.z);
    if (![x, y, z].every(Number.isFinite) ||
        x < -50 || x > 50 || z < -49 || z > 49 || y < 0 || y > 18) {
      throw new Error('位置不在图书馆可放置范围内');
    }
    return { x, y, z };
  }

  function pinForClient(pin) {
    return { ...pin, photo: Boolean(pin.photo), photoUrl: pin.photo ? '/api/pins/' + pin.id + '/photo' : null };
  }

  function visiblePins(user) {
    return pinStore.listPins(user, user.role === 'admin').map(pinForClient);
  }

  function emitPin(event, pin) {
    const value = pin ? pinForClient(pin) : null;
    io.to('admins').emit(event, value);
    io.to('user:' + pin.ownerId).emit(event, value);
    if (pinStore.settings.sharePins) io.to('players').emit(event, value);
  }

  const pinPhotoUpload = multer({
    storage: multer.diskStorage({
      destination: pinPhotoDir,
      filename: (req, file, cb) => {
        const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
        cb(null, crypto.randomUUID() + ext);
      },
    }),
    limits: { fileSize: config.maxPhotoMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        cb(new Error('只支持 JPEG、PNG 或 WebP 图片'));
        return;
      }
      cb(null, true);
    },
  });

  io.use((socket, next) => {
    const user = sessions.read(cookieToken(socket.handshake.headers.cookie));
    if (user) {
      socket.data.user = user;
      next();
    } else if (legacyEnabled) {
      socket.data.user = { id: 'legacy', username: '访客', role: 'player' };
      next();
    } else {
      next(new Error('请先登录'));
    }
  });

  // 后台入口跳转
  app.get('/admin', (req, res) => res.redirect('/admin/admin.html'));

  // ---- 静态资源 ----
  const dist = path.join(config.root, 'dist');
  if (fs.existsSync(dist)) app.use(express.static(dist));
  const uploadDir = path.join(config.dataDir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  if (legacyEnabled) app.use('/uploads', express.static(uploadDir));
  const modelsDir = path.join(config.root, 'models');
  if (fs.existsSync(modelsDir)) app.use('/models', express.static(modelsDir));

  // ---- multer：照片上传（10MB 上限）----
  const photoStorage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) =>
      cb(null, 'photo_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.jpg'),
  });
  const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: config.maxPhotoMb * 1024 * 1024 } });

  // ---- 工具 ----
  const sanitize = (s, max = 24) => String(s || '')
    .replace(/<[^>]*>/g, '')   // 去掉 <b> 这类标签
    .replace(/[<>&"'`]/g, '')  // 去掉残留的角括号等
    .trim().slice(0, max);
  const bearerToken = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = (req) => (req.user && req.user.role === 'admin') ||
    (legacyEnabled && auth.verify(bearerToken(req)));
  // 限速中间件工厂
  const rate = (key, limit, windowMs) => (req, res, next) => {
    if (!limiter.check(key + ':' + (req.ip || 'ip'), limit, windowMs)) {
      return res.status(429).json({ error: '操作太频繁，请稍后再试' });
    }
    next();
  };

  // ================= 公开接口 =================
  app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));
  app.get('/api/config', (req, res) => res.json({
    maxPlayers: config.maxPlayers,
    maxObjectsPerPlayer: config.maxObjectsPerPlayer,
    maxPins: MAX_PINS,
    maxPhotoMb: config.maxPhotoMb,
    adminUsername: ADMIN_NAME,
  }));

  app.post('/api/auth/register', rate('register', 10, 60000), (req, res) => {
    try {
      const account = pinStore.register(req.body && req.body.username);
      const user = { id: account.id, username: account.username, role: 'player' };
      issueCookie(res, req, user);
      res.status(201).json({ user });
    } catch (error) {
      res.status(error.message.includes('已注册') ? 409 : 400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', rate('login', 20, 60000), (req, res) => {
    let username;
    try { username = validateUsername(req.body && req.body.username); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (normalizeUsername(username) === normalizeUsername(ADMIN_NAME)) {
      return res.status(400).json({ error: '管理员请使用管理员登录' });
    }
    const account = pinStore.findAccount(username);
    if (!account) return res.status(404).json({ error: '没有这个账号，请先注册' });
    const user = { id: account.id, username: account.username, role: 'player' };
    issueCookie(res, req, user);
    res.json({ user });
  });

  app.post('/api/auth/admin', rate('admin-login', 10, 60000), (req, res) => {
    const username = normalizeUsername(req.body && req.body.username);
    const configuredName = normalizeUsername(config.adminUsername || ADMIN_NAME);
    const supplied = Buffer.from(String(req.body && req.body.password || ''), 'utf8');
    const expected = Buffer.from(String(config.adminPassword || ''), 'utf8');
    if (username !== configuredName || supplied.length !== expected.length ||
        !crypto.timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: '管理员用户名或密码错误' });
    }
    const user = { id: 'admin', username: config.adminUsername || ADMIN_NAME, role: 'admin' };
    issueCookie(res, req, user);
    res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res, Boolean(req.secure || process.env.NODE_ENV === 'production'));
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireUser, (req, res) => {
    res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
  });

  app.get('/api/pins', requireUser, (req, res) => res.json(visiblePins(req.user)));

  app.post('/api/pins', requireUser, (req, res) => {
    if (req.user.role !== 'player') return res.status(403).json({ error: '管理员账号不能放置玩家图钉' });
    try {
      const pin = pinStore.createPin(req.user, pinPosition(req.body));
      store.addLog({ action: 'pin_add', owner: req.user.id, pinId: pin.id });
      emitPin('pin-added', pin);
      res.status(201).json(pinForClient(pin));
    } catch (error) {
      res.status(error.message.includes('最多') ? 409 : 400).json({ error: error.message });
    }
  });

  app.put('/api/pins/:id', requireUser, (req, res) => {
    const pin = pinStore.getPin(req.params.id);
    if (!pin) return res.status(404).json({ error: '图钉不存在' });
    if (req.user.role !== 'admin' && pin.ownerId !== req.user.id) {
      return res.status(403).json({ error: '只能移动自己的图钉' });
    }
    try {
      const updated = pinStore.updatePin(pin.id, pinPosition(req.body));
      store.addLog({ action: 'pin_move', owner: pin.ownerId, pinId: pin.id });
      emitPin('pin-updated', updated);
      res.json(pinForClient(updated));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/pins/:id', requireUser, (req, res) => {
    const pin = pinStore.getPin(req.params.id);
    if (!pin) return res.status(404).json({ error: '图钉不存在' });
    if (req.user.role !== 'admin' && pin.ownerId !== req.user.id) {
      return res.status(403).json({ error: '只能删除自己的图钉' });
    }
    const removed = pinStore.deletePin(pin.id);
    if (removed.photo) fs.rmSync(path.join(pinPhotoDir, removed.photo), { force: true });
    store.addLog({ action: 'pin_delete', owner: removed.ownerId, pinId: removed.id });
    io.to('admins').emit('pin-deleted', { id: removed.id });
    io.to('user:' + removed.ownerId).emit('pin-deleted', { id: removed.id });
    if (pinStore.settings.sharePins) io.to('players').emit('pin-deleted', { id: removed.id });
    res.json({ ok: true });
  });

  app.post('/api/pins/:id/photo', requireUser, rate('pin-photo', 20, 60000), pinPhotoUpload.single('photo'), (req, res) => {
    const pin = pinStore.getPin(req.params.id);
    if (!pin) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(404).json({ error: '图钉不存在' });
    }
    if (req.user.role !== 'admin' && pin.ownerId !== req.user.id) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(403).json({ error: '只能为自己的图钉上传照片' });
    }
    if (!req.file) return res.status(400).json({ error: '请选择一张照片' });
    const fd = fs.openSync(req.file.path, 'r');
    const header = Buffer.alloc(12);
    let bytesRead;
    try { bytesRead = fs.readSync(fd, header, 0, header.length, 0); }
    finally { fs.closeSync(fd); }
    const validImage = req.file.mimetype === 'image/jpeg'
      ? bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : req.file.mimetype === 'image/png'
        ? bytesRead === 12 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : bytesRead === 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    if (!validImage) {
      fs.rmSync(req.file.path, { force: true });
      return res.status(400).json({ error: '上传文件不是有效的图片' });
    }
    const previous = pin.photo;
    const changed = pinStore.setPhoto(pin.id, path.basename(req.file.filename));
    if (previous) fs.rmSync(path.join(pinPhotoDir, previous), { force: true });
    emitPin('pin-updated', changed.pin);
    store.addLog({ action: 'pin_photo', owner: pin.ownerId, pinId: pin.id });
    res.json(pinForClient(changed.pin));
  });

  app.get('/api/pins/:id/photo', requireUser, (req, res) => {
    const pin = pinStore.getPin(req.params.id);
    if (!pin || !pin.photo) return res.status(404).json({ error: '照片不存在' });
    if (req.user.role !== 'admin' && pin.ownerId !== req.user.id && !pinStore.settings.sharePins) {
      return res.status(403).json({ error: '照片尚未对其他玩家开放' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    const photoPath = path.join(pinPhotoDir, path.basename(pin.photo));
    res.sendFile(photoPath, (error) => {
      if (!error || res.headersSent) return;
      if (error.code === 'ENOENT' || error.status === 404) {
        return res.status(404).json({ error: '照片文件不存在' });
      }
      console.error('Failed to serve pin photo:', error);
      return res.status(500).json({ error: '读取照片失败' });
    });
  });

  app.get('/api/admin/pins', requireAdmin, (req, res) => res.json(visiblePins(req.user)));

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const body = req.body || {};
    const updated = pinStore.setSettings({
      ...(typeof body.sharePins === 'boolean' ? { sharePins: body.sharePins } : {}),
      ...(typeof body.sharedGhost === 'boolean' ? { sharedGhost: body.sharedGhost } : {}),
    });
    io.to('admins').emit('world-settings', updated);
    io.to('players').emit('world-settings', updated);
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.user && socket.data.user.role === 'player') {
        if (updated.sharePins) socket.join('players');
        else socket.leave('players');
        socket.emit('world-settings', updated);
        socket.emit('pins-snapshot', visiblePins(socket.data.user));
      }
    }
    res.json(updated);
  });

  app.get('/api/floors', requireUser, (req, res) => {
    const floors = [];
    for (let level = 0; level <= 18; level++) {
      const file = path.join(config.root, 'floor_y' + String(level + 2).padStart(2, '0') + '.png');
      if (fs.existsSync(file)) floors.push(level);
    }
    res.json({ floors, width: 100, depth: 98, centerX: 49.5, centerZ: 48.5 });
  });

  app.get('/floorplans/:level.png', requireUser, (req, res) => {
    const level = Number(req.params.level);
    if (!Number.isInteger(level) || level < 0 || level > 18) return res.sendStatus(404);
    const file = path.join(config.root, 'floor_y' + String(level + 2).padStart(2, '0') + '.png');
    if (!fs.existsSync(file)) return res.sendStatus(404);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(file);
  });

  if (!legacyEnabled) {
    app.use(['/api/upload', '/api/generate', '/api/objects', '/api/rooms'], (req, res) =>
      res.status(404).json({ error: '此版本使用图钉，不提供旧版 3D 物件功能' }));
  }

  // 1) 上传照片 → photoId + 预览地址
  app.post('/api/upload', rate('upload', 20, 60000), uploadPhoto.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '没有收到照片' });
    const photoId = path.basename(req.file.filename, path.extname(req.file.filename));
    store.addLog({ action: 'upload', photoId, ip: req.ip });
    res.json({ photoId, previewUrl: '/uploads/' + path.basename(req.file.filename) });
  });

  // 2) 确认生成 → 入队 → taskId
  app.post('/api/generate', (req, res) => {
    const b = req.body || {};
    if (!b.photoId) return res.status(400).json({ error: '缺少 photoId' });
    const photoPath = path.join(uploadDir, b.photoId + '.jpg');
    if (!fs.existsSync(photoPath)) return res.status(400).json({ error: '照片不存在或已过期' });
    if (b.owner && store.countByOwner(b.owner, b.room) >= config.maxObjectsPerPlayer) {
      return res.status(400).json({ error: '已达每人上限 ' + config.maxObjectsPerPlayer + ' 个' });
    }
    const taskId = hyper3d.generate({
      photoId: b.photoId, photoPath, room: b.room, owner: b.owner,
      ownerName: sanitize(b.ownerName, 24), name: sanitize(b.name, 24) || '物件',
    });
    store.addLog({ action: 'generate_start', taskId, photoId: b.photoId, room: b.room, owner: b.owner });
    res.json({ taskId });
  });

  // 3) 轮询生成状态（done 时附带自动缩放比例）
  app.get('/api/generate/:taskId', (req, res) => {
    const st = hyper3d.getStatus(req.params.taskId);
    if (!st) return res.status(404).json({ error: '任务不存在' });
    if (st.status === 'done' && st.result && st.result.dimensions) {
      const d = st.result.dimensions;
      const h = Math.max(d.x, d.y, d.z);
      st.result.scale = Number((config.targetHeight / h).toFixed(4));
    }
    res.json(st);
  });

  // 4) 物件 CRUD
  app.get('/api/objects', (req, res) => {
    res.json(store.objectsInRoom(req.query.room).map(publicObject));
  });

  app.post('/api/objects', (req, res) => {
    const b = req.body || {};
    if (store.countByOwner(b.owner, b.room) >= config.maxObjectsPerPlayer) {
      return res.status(400).json({ error: '已达每人上限 ' + config.maxObjectsPerPlayer + ' 个' });
    }
    const obj = {
      id: b.id, name: sanitize(b.name, 24) || '物件',
      url: String(b.url || ''), x: +b.x || 0, y: +b.y || 0, z: +b.z || 0,
      rotY: +b.rotY || 0, scale: +b.scale || 1,
      owner: b.owner, ownerName: sanitize(b.ownerName, 24), room: b.room || 'main',
      time: Date.now(),
    };
    store.addObject(obj);
    store.addLog({ action: 'place', id: obj.id, owner: obj.owner, room: obj.room, name: obj.name });
    io.to(roomKey(obj.room)).emit('object-added', publicObject(obj));
    res.json(publicObject(obj));
  });

  // 搬动/缩放/旋转（只有上传者本人或管理员）
  app.put('/api/objects/:id', (req, res) => {
    const o = store.getObject(req.params.id);
    if (!o) return res.status(404).json({ error: '物件不存在' });
    const actor = req.body && req.body.actor;
    if (o.owner !== actor && !isAdmin(req)) return res.status(403).json({ error: '只有上传者或管理员能操作' });
    const patch = {
      x: +req.body.x, y: +req.body.y, z: +req.body.z,
      rotY: +req.body.rotY, scale: +req.body.scale,
      updatedAt: req.body.updatedAt || Date.now(),
    };
    const upd = store.updateObject(o.id, patch);
    store.addLog({ action: 'move', id: o.id, actor: actor || 'admin' });
    io.to(roomKey(o.room)).emit('object-moved', publicObject(upd));
    res.json(publicObject(upd));
  });

  // 删除（只有上传者本人或管理员）
  app.delete('/api/objects/:id', (req, res) => {
    const o = store.getObject(req.params.id);
    if (!o) return res.status(404).json({ error: '物件不存在' });
    const actor = req.body && req.body.actor;
    if (o.owner !== actor && !isAdmin(req)) return res.status(403).json({ error: '只有上传者或管理员能操作' });
    store.deleteObject(o.id);
    store.addLog({ action: 'delete', id: o.id, actor: actor || 'admin' });
    io.to(roomKey(o.room)).emit('object-removed', { id: o.id });
    res.json({ ok: true });
  });

  // 5) 房间
  app.get('/api/rooms', (req, res) => res.json(store.rooms.map((r) => ({ id: r.id, name: r.name, created: r.created }))));
  app.post('/api/rooms', (req, res) => {
    const r = store.addRoom({ name: sanitize(req.body && req.body.name, 24) || '新房间' });
    res.json({ id: r.id, name: r.name });
  });

  // ================= 管理员接口（密码登录） =================
  app.post('/api/admin/login', rate('login', 10, 60000), (req, res) => {
    const token = auth.login(req.body && req.body.password);
    if (!token) {
      store.addLog({ action: 'login_fail', ip: req.ip });
      return res.status(401).json({ error: '密码错误' });
    }
    store.addLog({ action: 'login_ok', ip: req.ip });
    issueCookie(res, req, { id: 'admin', username: config.adminUsername || ADMIN_NAME, role: 'admin' });
    res.json({ token });
  });

  app.get('/api/admin/rooms', requireAdmin, (req, res) => res.json(store.rooms));
  app.get('/api/admin/logs', requireAdmin, (req, res) => res.json(store.logs.slice(-500).reverse()));
  app.get('/api/admin/stats', requireAdmin, (req, res) => res.json({
    objects: store.objects.length,
    rooms: store.rooms.length,
    logs: store.logs.length,
    online: Object.keys(players).length,
  }));

  // 合并查看：?rooms=a,b,c 同时返回多个房间的物件（只是查看，不搬动）
  app.get('/api/admin/merge', requireAdmin, (req, res) => {
    const rooms = String(req.query.rooms || '').split(',').map((s) => s.trim()).filter(Boolean);
    const list = rooms.length ? store.objects.filter((o) => rooms.includes(o.room)) : store.objects;
    res.json(list.map(publicObject));
  });

  // 管理员删任意物件
  app.delete('/api/admin/objects/:id', requireAdmin, (req, res) => {
    const o = store.getObject(req.params.id);
    if (!o) return res.status(404).json({ error: '物件不存在' });
    store.deleteObject(o.id);
    store.addLog({ action: 'admin_delete', id: o.id, admin: true });
    io.to(roomKey(o.room)).emit('object-removed', { id: o.id });
    res.json({ ok: true });
  });

  // multer 上传错误处理（照片超限 → 413）
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '照片太大，超过上限' : '上传错误: ' + err.code });
    }
    if (err) return res.status(400).json({ error: String(err.message || err) });
    next();
  });

  // ================= Socket.IO 多人同步 =================
  const players = {}; // socketId -> player
  const onlineCount = () => Object.keys(players).length;

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.on('join', (data) => {
      if (user.role === 'player' && onlineCount() >= config.maxPlayers) {
        socket.emit('full', { max: config.maxPlayers });
        return;
      }
      const legacyName = legacyEnabled && user.id === 'legacy'
        ? sanitize(data && data.name, 24) || '玩家'
        : user.username;
      const p = {
        id: socket.id,
        userId: user.id,
        role: user.role,
        name: legacyName,
        color: String(data && data.color || '#4aa3ff'),
        room: legacyEnabled ? (sanitize(data && data.room, 24) || 'main') : 'main',
        x: +(data && data.x) || 0, y: +(data && data.y) || 0, z: +(data && data.z) || 0,
        yaw: 0, pitch: 0,
      };
      players[socket.id] = p;
      socket.join(p.room);
      if (user.role === 'admin') socket.join('admins');
      else {
        socket.join('user:' + user.id);
        if (pinStore.settings.sharePins) socket.join('players');
      }
      socket.emit('joined', { id: socket.id, room: p.room });
      socket.broadcast.to(p.room).emit('player-joined', p);
      socket.emit('state', {
        players: Object.values(players),
        pins: visiblePins(user),
        settings: { ...pinStore.settings },
        objects: legacyEnabled ? store.objects.map(publicObject) : [],
        config: { maxPlayers: config.maxPlayers, maxObjectsPerPlayer: config.maxObjectsPerPlayer, maxPins: MAX_PINS },
      });
    });

    socket.on('move', (data) => {
      const p = players[socket.id];
      if (!p) return;
      if (data.x !== undefined) p.x = +data.x;
      if (data.y !== undefined) p.y = +data.y;
      if (data.z !== undefined) p.z = +data.z;
      if (data.yaw !== undefined) p.yaw = +data.yaw;
      if (data.pitch !== undefined) p.pitch = +data.pitch;
      socket.broadcast.to(p.room).emit('player-move', {
        id: socket.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
      });
    });

    socket.on('room-switch', (room) => {
      if (!legacyEnabled) return;
      const p = players[socket.id];
      if (!p) return;
      const prev = p.room;
      p.room = sanitize(room, 24) || 'main';
      socket.leave(prev);
      socket.join(p.room);
      socket.broadcast.to(prev).emit('player-left', { id: socket.id });
      socket.broadcast.to(p.room).emit('player-joined', p);
      socket.emit('room-changed', { room: p.room });
    });

    socket.on('disconnect', () => {
      const p = players[socket.id];
      if (!p) return;
      delete players[socket.id];
      socket.broadcast.to(p.room).emit('player-left', { id: socket.id });
    });
  });

  // ---- 返回可测试对象 ----
  const server = { httpServer, app, io, store, hyper3d, config, players };
  // 跟踪连接，close 时强制销毁（避免 keep-alive 卡住 httpServer.close）
  const connections = new Set();
  httpServer.on('connection', (sock) => {
    connections.add(sock);
    sock.on('close', () => connections.delete(sock));
  });
  server.start = () => new Promise((resolve) => httpServer.listen(config.port, resolve));
  server.close = () => new Promise((resolve) => {
    io.close();
    for (const sock of connections) sock.destroy();
    httpServer.close(() => resolve());
    setTimeout(resolve, 800).unref(); // 兜底，避免卡死
  });
  server.port = () => httpServer.address().port;
  return server;
}

module.exports = { createApp, publicObject, roomKey };
