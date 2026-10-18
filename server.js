/* Minecraft 建筑多人服务器：静态服务 + 实时同步 + 3D 物件上传 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 8900;
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const OBJECTS_FILE = path.join(ROOT, 'objects.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静态文件
app.use(express.static(ROOT, { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR));

// 上传 3D 物件
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.glb';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  res.json({ id: path.basename(req.file.filename), url: '/uploads/' + req.file.filename });
});

// 状态
const players = {};            // socketId -> {x,y,z,yaw,pitch,name,color}
const objects = [];            // 已放置物件

// 持久化物件
function saveObjects() {
  try { fs.writeFileSync(OBJECTS_FILE, JSON.stringify(objects, null, 1)); } catch (e) {}
}
function loadObjects() {
  try {
    const arr = JSON.parse(fs.readFileSync(OBJECTS_FILE, 'utf-8'));
    objects.push(...(Array.isArray(arr) ? arr : []));
  } catch (e) {}
}
loadObjects();

function randomColor() {
  const h = Math.random() * 360;
  return `hsl(${h.toFixed(0)},70%,55%)`;
}

io.on('connection', (socket) => {
  // 新玩家加入：发给他当前所有玩家和已放置物件
  socket.emit('state', { players, objects });

  socket.on('join', (data) => {
    players[socket.id] = {
      x: data.x || 0, y: data.y || 20, z: data.z || 0,
      yaw: 0, pitch: 0, name: String(data.name || '玩家').slice(0, 12),
      color: randomColor(),
    };
    socket.broadcast.emit('player-joined', { id: socket.id, ...players[socket.id] });
  });

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p) return;
    Object.assign(p, data);
    socket.broadcast.emit('player-move', { id: socket.id, ...data });
  });

  socket.on('object', (obj) => {
    const full = {
      id: obj.id, url: obj.url, x: obj.x, y: obj.y, z: obj.z,
      rotY: obj.rotY || 0, scale: obj.scale || 1, name: obj.name || '物件',
      owner: socket.id, time: Date.now(),
    };
    objects.push(full);
    saveObjects();
    socket.broadcast.emit('object-added', full);
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('player-left', { id: socket.id });
  });
});

server.listen(PORT, () => {
  console.log('Minecraft 建筑服务器已启动: http://localhost:' + PORT);
  console.log('上传目录:', UPLOAD_DIR);
});
