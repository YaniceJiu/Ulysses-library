const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io: ioClient } = require('socket.io-client');
const { createApp } = require('../server/app');

async function start(dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcwt-pins-'))) {
  const server = createApp({
    port: 0,
    dataDir,
    root: path.resolve(__dirname, '..'),
    adminPassword: 'a-secure-test-password',
    adminUsername: 'JaniceJiu',
    authSecret: 'pin-test-secret-that-is-long-enough',
    maxPhotoMb: 2,
    maxPlayers: 50,
    enableLegacyFeatures: false,
  });
  await server.start();
  server.base = 'http://127.0.0.1:' + server.port();
  return server;
}

async function json(server, route, method = 'GET', body, cookie) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const response = await fetch(server.base + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    response,
    data: response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : null,
    cookie: response.headers.getSetCookie()?.[0]?.split(';')[0],
  };
}

async function register(server, username) {
  const result = await json(server, '/api/auth/register', 'POST', { username });
  assert.equal(result.response.status, 201);
  return result.cookie;
}

async function loginAdmin(server) {
  const result = await json(server, '/api/auth/admin', 'POST', {
    username: 'JaniceJiu', password: 'a-secure-test-password',
  });
  assert.equal(result.response.status, 200);
  return result.cookie;
}

const position = (offset = 0) => ({ x: offset, y: 0, z: 0 });

test('用户名不区分大小写，管理员名字保留', async () => {
  const server = await start();
  try {
    const cookie = await register(server, 'Alice');
    const duplicate = await json(server, '/api/auth/register', 'POST', { username: ' alice ' });
    assert.equal(duplicate.response.status, 409);
    assert.equal((await json(server, '/api/auth/login', 'POST', { username: 'ALICE' })).response.status, 200);
    assert.equal((await json(server, '/api/auth/register', 'POST', { username: 'janicejiu' })).response.status, 400);
    assert.equal((await json(server, '/api/pins', 'GET')).response.status, 401);
    assert.equal((await json(server, '/api/pins', 'POST', position())).response.status, 401);
    assert.equal((await json(server, '/api/auth/admin', 'POST', {
      username: 'JaniceJiu', password: 'wrong-password',
    })).response.status, 401);
    assert.ok(cookie.includes('mcwt_session='));
  } finally {
    await server.close();
  }
});

test('图钉上限、所有权、照片授权与管理员全局 Board', async () => {
  const server = await start();
  try {
    const alice = await register(server, 'Alice');
    const bob = await register(server, 'Bob');
    const created = [];
    for (let i = 0; i < 5; i++) {
      const result = await json(server, '/api/pins', 'POST', position(i), alice);
      assert.equal(result.response.status, 201);
      created.push(result.data);
    }
    assert.equal((await json(server, '/api/pins', 'POST', position(6), alice)).response.status, 409);
    assert.equal((await json(server, '/api/pins/' + created[0].id, 'PUT', position(2), bob)).response.status, 403);
    assert.equal((await json(server, '/api/pins', 'GET', undefined, bob)).data.length, 0);
    assert.equal((await json(server, '/api/upload', 'POST', {}, alice)).response.status, 404);

    const admin = await loginAdmin(server);
    const allPins = await json(server, '/api/admin/pins', 'GET', undefined, admin);
    assert.equal(allPins.data.length, 5);
    assert.equal((await json(server, '/api/admin/pins')).response.status, 401);
    const assigned = await json(server, '/api/admin/pins', 'POST', {
      username: 'Bob', ...position(7),
    }, admin);
    assert.equal(assigned.response.status, 201);
    assert.equal(assigned.data.ownerId, 'bob');
    assert.equal(assigned.data.ownerName, 'Bob');
    assert.equal((await json(server, '/api/pins', 'GET', undefined, alice)).data.length, 5);
    assert.equal((await json(server, '/api/admin/pins', 'POST', {
      username: 'NotRegistered', ...position(8),
    }, admin)).response.status, 404);
    assert.equal((await json(server, '/api/admin/pins', 'POST', {
      username: 'Alice', ...position(8),
    }, admin)).response.status, 409);
    const adminPhoto = new FormData();
    adminPhoto.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'admin-pin.jpg');
    const adminUpload = await fetch(server.base + '/api/pins/' + assigned.data.id + '/photo', {
      method: 'POST', headers: { cookie: admin }, body: adminPhoto,
    });
    assert.equal(adminUpload.status, 200);
    assert.equal((await adminUpload.json()).photo, true);

    const form = new FormData();
    form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'pin.jpg');
    const uploaded = await fetch(server.base + '/api/pins/' + created[0].id + '/photo', {
      method: 'POST', headers: { cookie: alice }, body: form,
    });
    assert.equal(uploaded.status, 200);
    const privatePhoto = await fetch(server.base + '/api/pins/' + created[0].id + '/photo', {
      headers: { cookie: bob },
    });
    assert.equal(privatePhoto.status, 403);

    const settings = await json(server, '/api/admin/settings', 'PUT', {
      sharePins: true, sharedGhost: true,
    }, admin);
    assert.equal(settings.data.sharePins, true);
    assert.equal(settings.data.sharedGhost, true);
    assert.equal((await json(server, '/api/pins', 'GET', undefined, bob)).data.length, 6);
    const sharedPhoto = await fetch(server.base + '/api/pins/' + created[0].id + '/photo', {
      headers: { cookie: bob },
    });
    assert.equal(sharedPhoto.status, 200);

    assert.equal((await json(server, '/api/pins/' + created[0].id, 'DELETE', undefined, bob)).response.status, 403);
    assert.equal((await json(server, '/api/pins/' + created[0].id, 'DELETE', undefined, alice)).response.status, 200);
  } finally {
    await server.close();
  }
});

test('账号、图钉、照片和全局开关在重启后保留', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcwt-pins-persist-'));
  const first = await start(dataDir);
  let alice;
  let admin;
  let pin;
  try {
    alice = await register(first, 'Persisted');
    admin = await loginAdmin(first);
    pin = (await json(first, '/api/pins', 'POST', position(), alice)).data;
    await json(first, '/api/admin/settings', 'PUT', { sharePins: true }, admin);
    const form = new FormData();
    form.append('photo', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'pin.jpg');
    const photo = await fetch(first.base + '/api/pins/' + pin.id + '/photo', {
      method: 'POST', headers: { cookie: alice }, body: form,
    });

    test('Socket.IO 按可见性实时广播图钉和全局幽灵状态', async () => {
      const server = await start();
      const sockets = [];
      try {
        const alice = await register(server, 'Alice');
        const bob = await register(server, 'Bob');
        const admin = await loginAdmin(server);
        async function join(cookie) {
          const socket = ioClient(server.base, {
            extraHeaders: { Cookie: cookie },
            transports: ['websocket'],
            reconnection: false,
          });
          sockets.push(socket);
          await new Promise((resolve, reject) => {
            socket.once('connect', resolve);
            socket.once('connect_error', reject);
          });
          const state = new Promise((resolve) => socket.once('state', resolve));
          socket.emit('join', {});
          await state;
          return socket;
        }
        const ownerSocket = await join(alice);
        const otherSocket = await join(bob);
        const adminSocket = await join(admin);

        const pinEvent = new Promise((resolve) => adminSocket.once('pin-added', resolve));
        const pin = await json(server, '/api/pins', 'POST', position(), alice);
        assert.equal(pin.response.status, 201);
        assert.equal((await pinEvent).id, pin.data.id);

        let privateEvent = false;
        otherSocket.once('pin-added', () => { privateEvent = true; });
        await new Promise((resolve) => setTimeout(resolve, 60));
        assert.equal(privateEvent, false);

        const enabledEvent = new Promise((resolve) => otherSocket.once('world-settings', resolve));
        const snapshotEvent = new Promise((resolve) => otherSocket.once('pins-snapshot', resolve));
        await json(server, '/api/admin/settings', 'PUT', { sharePins: true }, admin);
        assert.equal((await enabledEvent).sharePins, true);
        assert.equal((await snapshotEvent).length, 1);

        const moved = new Promise((resolve) => otherSocket.once('pin-updated', resolve));
        await json(server, '/api/pins/' + pin.data.id, 'PUT', position(4), alice);
        assert.equal((await moved).x, 4);

        const ghostEvent = new Promise((resolve) => otherSocket.once('world-settings', resolve));
        await json(server, '/api/admin/settings', 'PUT', { sharedGhost: true }, admin);
        assert.equal((await ghostEvent).sharedGhost, true);
        assert.ok(ownerSocket.connected);
      } finally {
        sockets.forEach((socket) => socket.disconnect());
        await server.close();
      }
    });
    assert.equal(photo.status, 200);
  } finally {
    await first.close();
  }

  const second = await start(dataDir);
  try {
    const pins = await json(second, '/api/pins', 'GET', undefined, alice);
    assert.equal(pins.data.length, 1);
    assert.equal(pins.data[0].photo, true);
    const settings = await json(second, '/api/admin/pins', 'GET', undefined, admin);
    assert.equal(settings.data.length, 1);
  } finally {
    await second.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
