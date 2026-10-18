/** 多人网络：socket.io 连接、加入、移动同步、物件事件 */
import { io } from 'socket.io-client';
import { store } from './store';

let socket = null;

export const net = {
  connect() {
    return new Promise((resolve, reject) => {
      socket = io('/', { transports: ['websocket', 'polling'], reconnection: true });

      socket.on('connect', () => {
        socket.emit('join', {
          name: store.name,
          color: store.color,
          room: store.room,
          x: store.playerPos.x, y: store.playerPos.y, z: store.playerPos.z,
        });
      });

      socket.on('joined', (d) => {
        store.playerId = d.id;
        store.room = d.room;
        store.joined = true;
        store.full = false;
        resolve();
      });

      socket.on('full', (d) => {
        store.full = true;
        store.maxPlayers = d.max;
        reject(new Error('full'));
      });

      socket.on('state', (d) => {
        if (d.config) {
          store.maxPlayers = d.config.maxPlayers;
          store.cfg = d.config;
        }
        store.players = d.players || [];
        store.objects = d.objects || [];
        store.pins = d.pins || [];
        store.settings = d.settings || { sharePins: false, sharedGhost: false };
        store.online = store.players.length;
      });

      socket.on('pins-snapshot', (pins) => { store.pins = pins || []; });
      socket.on('pin-added', (pin) => upsertPin(pin));
      socket.on('pin-updated', (pin) => upsertPin(pin));
      socket.on('pin-deleted', ({ id }) => {
        store.pins = store.pins.filter((pin) => pin.id !== id);
        if (store.selectedPin && store.selectedPin.id === id) store.selectedPin = null;
      });
      socket.on('world-settings', (settings) => { store.settings = settings; });

      socket.on('player-joined', (p) => {
        store.players = store.players.filter((x) => x.id !== p.id).concat([p]);
        store.online = store.players.length;
      });

      socket.on('player-left', ({ id }) => {
        store.players = store.players.filter((x) => x.id !== id);
        store.online = store.players.length;
        store.hiddenOwners = store.hiddenOwners.filter((x) => x !== id);
      });

      socket.on('player-move', (m) => {
        const p = store.players.find((x) => x.id === m.id);
        if (p) Object.assign(p, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch });
      });

      socket.on('object-added', (o) => {
        if (!store.objects.find((x) => x.id === o.id)) store.objects.push(o);
      });
      socket.on('object-moved', (o) => {
        const i = store.objects.findIndex((x) => x.id === o.id);
        if (i >= 0) store.objects[i] = o;
      });
      socket.on('object-removed', ({ id }) => {
        store.objects = store.objects.filter((x) => x.id !== id);
        if (store.selectedObject && store.selectedObject.id === id) {
          store.selectedObject = null;
          store.movingObject = false;
        }
      });

      socket.on('connect_error', (error) => {
        store.error = error.message === '请先登录' ? error.message : '实时连接失败，请刷新后重试';
        reject(error);
      });
    });
  },

  sendMove() {
    if (socket && socket.connected && store.joined) {
      socket.emit('move', store.playerPos);
    }
  },

  disconnect() {
    if (socket) socket.disconnect();
    socket = null;
  },
};

function upsertPin(pin) {
  if (!pin) return;
  const index = store.pins.findIndex((item) => item.id === pin.id);
  if (index < 0) store.pins.push(pin);
  else store.pins[index] = pin;
}
