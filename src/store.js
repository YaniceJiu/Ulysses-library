/** 全局响应式状态（Vue reactive，UI 与 3D 场景共用） */
import { reactive } from 'vue';

function lsGet(key, def) {
  try { return localStorage.getItem(key) || def; } catch (e) { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
}

export const store = reactive({
  screen: 'start',        // start | world
  connecting: false,
  joined: false,
  full: false,

  name: lsGet('mcwt_name', ''),
  user: null,
  authMode: 'register',
  role: 'player',
  color: lsGet('mcwt_color', '#4aa3ff'),
  room: lsGet('mcwt_room', 'main'),
  rooms: [],

  playerId: null,
  players: [],            // 同房间在线玩家 [{id,name,color,x,y,z,yaw,pitch}]
  objects: [],
  pins: [],
  settings: { sharePins: false, sharedGhost: false },
  floorMap: { floors: [], width: 100, depth: 98, centerX: 49.5, centerZ: 48.5 },
  hiddenOwners: [],       // 勾选后隐藏其物件的玩家 id（空=全显示）

  playerPos: { x: 41, y: 0, z: 46, yaw: 0, pitch: 0 },  // 建筑北墙真实入口(东北角 x≈41)前，朝南走进建筑

  ghost: false,           // 幽灵模式
  locked: false,          // 鼠标是否被锁定（第一人称）
  showPhoto: false,
  showBoard: false,
  showVisibility: false,
  selectedPin: null,
  placingPin: false,
  movingPin: null,
  error: '',
  selectedObject: null,   // 点中的物件
  movingObject: false,    // 正在搬动
  placing: null,          // 待放置 {url, scale, rotY, dims, taskId}
  generating: false,
  genStatus: null,        // {status, error?}
  photoPreview: null,     // 预览用的图片 dataURL

  online: 0,
  maxPlayers: 50,
  cfg: {},
});

export function saveIdentity() {
  lsSet('mcwt_name', store.name);
  lsSet('mcwt_color', store.color);
  lsSet('mcwt_room', store.room);
}

export function rememberPos() {
  try {
    lsSet('mcwt_pos_v4', JSON.stringify({ x: store.playerPos.x, y: store.playerPos.y, z: store.playerPos.z, yaw: store.playerPos.yaw }));
  } catch (e) {}
}
export function restorePos() {
  try {
    const p = JSON.parse(lsGet('mcwt_pos_v4', 'null'));
    if (p) { store.playerPos.x = p.x; store.playerPos.y = p.y; store.playerPos.z = p.z; store.playerPos.yaw = p.yaw || 0; }
  } catch (e) {}
}

// 是否显示某玩家的物件（默认全显示，勾选取消=隐藏）
export function visibleOwner(id) {
  return !store.hiddenOwners.includes(id);
}
