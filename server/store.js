/** 数据存储：物件 / 房间 / 日志，JSON 文件 + 原子串行写入（防读写冲突损坏） */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DataStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.objectsFile = path.join(dataDir, 'objects.json');
    this.roomsFile = path.join(dataDir, 'rooms.json');
    this.logsFile = path.join(dataDir, 'logs.json');
    this.objects = [];
    this.rooms = [];
    this.logs = [];
    // 写入串行链：所有写操作排队，避免并发写同一个文件
    this._chain = Promise.resolve();
    this.load();
  }

  load() {
    this.objects = this._read(this.objectsFile, []);
    this.rooms = this._read(this.roomsFile, []);
    this.logs = this._read(this.logsFile, []);
  }

  _read(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      return fallback;
    }
  }

  // 原子写：先写 .tmp 再 rename，任何时刻文件都是完整的
  _write(file, data) {
    const prev = this._chain;
    this._chain = prev.then(async () => {
      const tmp = file + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(data, null, 1), 'utf-8');
      await fs.promises.rename(tmp, file);
    }).catch((err) => {
      console.error('[store] 写入失败', file, err.message);
    });
    return this._chain;
  }

  _flush() {
    // 等所有排队写入完成（测试用）
    return this._chain;
  }

  saveObjects() { return this._write(this.objectsFile, this.objects); }
  saveRooms() { return this._write(this.roomsFile, this.rooms); }
  saveLogs() { return this._write(this.logsFile, this.logs); }

  // ---------- 物件 ----------
  addObject(obj) {
    obj.id = obj.id || crypto.randomUUID();
    obj.time = obj.time || Date.now();
    obj.updatedAt = obj.updatedAt || obj.time;
    this.objects.push(obj);
    return this.saveObjects();
  }

  getObject(id) {
    return this.objects.find((o) => o.id === id) || null;
  }

  // 最后写入胜出：patch.updatedAt 必须 >= 当前 updatedAt，否则忽略
  updateObject(id, patch) {
    const o = this.getObject(id);
    if (!o) return null;
    const ts = patch.updatedAt || Date.now();
    if (ts < o.updatedAt) return o; // 过期写入，忽略
    Object.assign(o, patch, { updatedAt: ts });
    return o;
  }

  deleteObject(id) {
    const i = this.objects.findIndex((o) => o.id === id);
    if (i < 0) return false;
    this.objects.splice(i, 1);
    return this.saveObjects();
  }

  objectsInRoom(roomId) {
    return roomId ? this.objects.filter((o) => o.room === roomId) : this.objects;
  }

  countByOwner(ownerId, roomId) {
    return this.objects.filter((o) => o.owner === ownerId && o.room === roomId).length;
  }

  // ---------- 房间 ----------
  addRoom(r) {
    r.id = r.id || crypto.randomUUID();
    r.created = r.created || Date.now();
    this.rooms.push(r);
    return this.saveRooms();
  }

  getRoom(id) {
    return this.rooms.find((r) => r.id === id) || null;
  }

  // ---------- 日志 ----------
  addLog(entry) {
    this.logs.push({ id: crypto.randomUUID(), time: Date.now(), ...entry });
    // 只保留最近 2000 条，防止无限膨胀
    if (this.logs.length > 2000) this.logs.splice(0, this.logs.length - 2000);
    return this.saveLogs();
  }
}

module.exports = { DataStore };
