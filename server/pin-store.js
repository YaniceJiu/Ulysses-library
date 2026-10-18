const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_PINS = 5;
const ADMIN_NAME = 'JaniceJiu';

function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function validateUsername(value) {
  const username = String(value || '').normalize('NFKC').trim();
  if (!/^[\p{L}\p{N}_.-]{2,24}$/u.test(username)) {
    throw new Error('用户名需为 2–24 个字母、数字、下划线、点或连字符');
  }
  if (normalizeUsername(username) === normalizeUsername(ADMIN_NAME)) {
    throw new Error('此用户名为管理员专用');
  }
  return username;
}

class PinStore {
  constructor(dataDir, photoDir) {
    this.dataDir = dataDir;
    this.photoDir = photoDir;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(photoDir, { recursive: true });
    this.accountsPath = path.join(dataDir, 'accounts.json');
    this.pinsPath = path.join(dataDir, 'pins.json');
    this.settingsPath = path.join(dataDir, 'pin-settings.json');
    this.accounts = this._read(this.accountsPath, []);
    this.pins = this._read(this.pinsPath, []);
    this.settings = { sharePins: false, sharedGhost: false, ...this._read(this.settingsPath, {}) };
  }

  _read(file, fallback) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      return value;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return fallback;
    }
  }

  _write(file, value) {
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  register(value) {
    const username = validateUsername(value);
    const key = normalizeUsername(username);
    if (this.accounts.some((account) => account.key === key)) {
      throw new Error('这个用户名已注册，请返回登录');
    }
    const account = { id: key, key, username, createdAt: Date.now() };
    this.accounts.push(account);
    this._write(this.accountsPath, this.accounts);
    return account;
  }

  findAccount(value) {
    const key = normalizeUsername(value);
    return this.accounts.find((account) => account.key === key) || null;
  }

  listPins(user, canSeeAll = false) {
    return this.pins
      .filter((pin) => canSeeAll || pin.ownerId === user.id || this.settings.sharePins)
      .map((pin) => ({ ...pin }));
  }

  createPin(user, position) {
    if (this.pins.filter((pin) => pin.ownerId === user.id).length >= MAX_PINS) {
      throw new Error('每个账号最多放置 5 枚图钉');
    }
    const pin = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ownerName: user.username,
      x: position.x,
      y: position.y,
      z: position.z,
      photo: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.pins.push(pin);
    this._write(this.pinsPath, this.pins);
    return { ...pin };
  }

  getPin(id) {
    return this.pins.find((pin) => pin.id === id) || null;
  }

  updatePin(id, position) {
    const pin = this.getPin(id);
    if (!pin) return null;
    Object.assign(pin, position, { updatedAt: Date.now() });
    this._write(this.pinsPath, this.pins);
    return { ...pin };
  }

  setPhoto(id, filename) {
    const pin = this.getPin(id);
    if (!pin) return null;
    const previous = pin.photo;
    pin.photo = filename;
    pin.updatedAt = Date.now();
    this._write(this.pinsPath, this.pins);
    return { pin: { ...pin }, previous };
  }

  deletePin(id) {
    const index = this.pins.findIndex((pin) => pin.id === id);
    if (index < 0) return null;
    const [pin] = this.pins.splice(index, 1);
    this._write(this.pinsPath, this.pins);
    return pin;
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this._write(this.settingsPath, this.settings);
    return { ...this.settings };
  }
}

module.exports = { PinStore, MAX_PINS, ADMIN_NAME, normalizeUsername, validateUsername };
