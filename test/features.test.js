/**
 * mc_walkthrough 功能测试（逐条检测）
 * 运行：npm test   （node --test test/）
 *
 * 覆盖：
 *  A. 服务器基础   B. 照片上传   C. AI 生成队列（并发/重试/超时/面数上限/照片清理/自动缩放）
 *  D. 物件 CRUD（归属/上限/最后写入胜出/XSS）  E. 房间
 *  F. 持久化（重启保留）  G. 管理员（登录/限速/日志/合并查看/删任意）
 *  H. Socket 多人（加入/满员/移动广播/名字净化）
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { io: ioClient } = require('socket.io-client');

const { createApp } = require('../server/app');
const { GenerationQueue } = require('../server/hyper3d');
const { DataStore } = require('../server/store');

// ---------- 工具 ----------
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mcwt-'));
}

// 假 AI 接口，可脚本化行为
function fakeApi(opts = {}) {
  const state = { createCalls: 0, pollCalls: 0, inFlight: 0, maxInFlight: 0 };
  const api = {
    state,
    async create() {
      state.createCalls++;
      if (opts.failCreates && state.createCalls <= opts.failCreates) throw new Error('remote down');
      if (opts.createDelayMs) await new Promise((r) => setTimeout(r, opts.createDelayMs));
      state.inFlight++;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      if (opts.trackInFlight) {
        await new Promise((r) => setTimeout(r, 60));
        state.inFlight--;
      }
      return { remoteId: 'r' + state.createCalls };
    },
    async poll() {
      state.pollCalls++;
      if (opts.alwaysRunning) return { status: 'running' };
      if (opts.runningBeforeDone && opts.runningBeforeDone > 0) {
        opts.runningBeforeDone--;
        return { status: 'running' };
      }
      if (opts.failPoll) return { status: 'failed', error: '生成失败' };
      return {
        status: 'done',
        result: {
          url: '/models/sample.glb',
          dimensions: opts.dimensions || { x: 1, y: 2, z: 1 },
          triangles: opts.triangles || 1200,
        },
      };
    },
  };
  return api;
}

// 起一个测试服务器（独立端口+临时数据目录）
async function startTest(overrides = {}) {
  const config = {
    port: 0,
    dataDir: tmpDir(),
    adminPassword: 'testpass',
    authSecret: 'testsecret',
    enableLegacyFeatures: true,
    maxPlayers: 50,
    maxObjectsPerPlayer: 20,
    maxPhotoMb: 10,
    maxTriangles: 50000,
    genTimeoutMs: 5000,
    genRetries: 2,
    pollMs: 20,
    retryBackoffMs: 5,
    targetHeight: 1.6,
    root: path.resolve(__dirname, '..'),
    ...overrides,
  };
  if (!config.hyper3dApi) config.hyper3dApi = overrides.hyper3dApi || fakeApi({});
  const server = createApp(config);
  await server.start();
  server._base = 'http://127.0.0.1:' + server.port();
  return server;
}

async function stop(server) {
  await server.close();
}

async function req(base, method, p, opts = {}) {
  const r = await fetch(base + p, {
    method,
    headers: opts.headers || {},
    body: opts.body,
  });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}

function photoForm(size = 4096) {
  const fd = new FormData();
  fd.append('photo', new Blob([Buffer.alloc(size, 0x47)], { type: 'image/jpeg' }), 'p.jpg');
  return fd;
}

// 上传一张照片，返回 {photoId, previewUrl}
async function uploadPhoto(base) {
  const r = await req(base, 'POST', '/api/upload', { body: photoForm() });
  assert.strictEqual(r.status, 200, '上传应成功: ' + JSON.stringify(r.data));
  return r.data;
}

// 轮询生成直到 done/failed
async function waitGen(base, taskId, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await req(base, 'GET', '/api/generate/' + taskId);
    if (r.data && (r.data.status === 'done' || r.data.status === 'failed')) return r.data;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error('等待生成超时');
}

// ---------- A. 服务器基础 ----------
test('A1 健康检查与公共配置', async () => {
  const s = await startTest();
  try {
    const h = await req(s._base, 'GET', '/api/health');
    assert.strictEqual(h.status, 200);
    assert.strictEqual(h.data.ok, true);
    const c = await req(s._base, 'GET', '/api/config');
    assert.strictEqual(c.data.maxPlayers, 50);
    assert.strictEqual(c.data.maxObjectsPerPlayer, 20);
    assert.strictEqual(c.data.maxPhotoMb, 10);
  } finally { await stop(s); }
});

// ---------- B. 照片上传 ----------
test('B1 上传照片成功，返回 photoId 和预览地址', async () => {
  const s = await startTest();
  try {
    const up = await uploadPhoto(s._base);
    assert.ok(up.photoId, '有 photoId');
    assert.ok(up.previewUrl.startsWith('/uploads/'), '有预览地址');
    // 预览文件真实存在
    const file = path.join(s.config.dataDir, 'uploads', path.basename(up.previewUrl));
    assert.ok(fs.existsSync(file), '照片文件已落盘');
  } finally { await stop(s); }
});

test('B2 超过照片大小上限被拒（413）', async () => {
  const s = await startTest({ maxPhotoMb: 1 });
  try {
    // 2MB > 1MB
    const r = await req(s._base, 'POST', '/api/upload', { body: photoForm(2 * 1024 * 1024) });
    assert.strictEqual(r.status, 413, '超限应被拒，实际 ' + r.status);
  } finally { await stop(s); }
});

test('B3 上传限速：一分钟内超 20 次返回 429', async () => {
  const s = await startTest();
  try {
    let got429 = false;
    for (let i = 0; i < 22; i++) {
      const r = await req(s._base, 'POST', '/api/upload', { body: photoForm() });
      if (r.status === 429) { got429 = true; break; }
    }
    assert.ok(got429, '第 21+ 次应被限速');
  } finally { await stop(s); }
});

// ---------- C. AI 生成队列 ----------
test('C1 完整流程：上传→生成→done，并附带自动缩放比例', async () => {
  const s = await startTest({
    hyper3dApi: fakeApi({ dimensions: { x: 2, y: 4, z: 2 }, triangles: 1000 }),
  });
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A', ownerName: '小明' }),
    });
    assert.strictEqual(g.status, 200);
    const done = await waitGen(s._base, g.data.taskId);
    assert.strictEqual(done.status, 'done');
    assert.strictEqual(done.result.url, '/models/sample.glb');
    // 自动缩放：高 4 格 → 目标 1.6 → scale=0.4
    assert.strictEqual(done.result.scale, 0.4);
  } finally { await stop(s); }
});

test('C2 生成队列并发=1：多个任务串行执行', async () => {
  const api = fakeApi({ createDelayMs: 40, trackInFlight: true });
  const s = await startTest({ hyper3dApi: api });
  try {
    const taskIds = [];
    for (let i = 0; i < 3; i++) {
      const up = await uploadPhoto(s._base);
      const g = await req(s._base, 'POST', '/api/generate', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
      });
      taskIds.push(g.data.taskId);
    }
    // 等所有任务完成
    for (const t of taskIds) await waitGen(s._base, t);
    assert.strictEqual(api.state.maxInFlight, 1, '同时只有 1 个任务在跑');
    assert.strictEqual(api.state.createCalls, 3);
  } finally { await stop(s); }
});

test('C3 失败自动重试：第 1 次失败，重试后成功', async () => {
  const s = await startTest({
    genRetries: 2,
    hyper3dApi: fakeApi({ failCreates: 1 }),
  });
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    const done = await waitGen(s._base, g.data.taskId);
    assert.strictEqual(done.status, 'done');
    assert.strictEqual(done.attempts, 2, '重试后成功，attempts=2');
  } finally { await stop(s); }
});

test('C4 一直失败：重试耗尽后标记 failed（让顾客重拍）', async () => {
  const s = await startTest({
    genRetries: 1,
    hyper3dApi: fakeApi({ failCreates: 99 }),
  });
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    const done = await waitGen(s._base, g.data.taskId);
    assert.strictEqual(done.status, 'failed');
    assert.ok(done.attempts >= 2);
  } finally { await stop(s); }
});

test('C5 生成超时：标记 failed 提示重拍', async () => {
  const s = await startTest({
    genTimeoutMs: 150,
    genRetries: 0,
    pollMs: 25,
    hyper3dApi: fakeApi({ alwaysRunning: true }),
  });
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    const done = await waitGen(s._base, g.data.taskId);
    assert.strictEqual(done.status, 'failed');
    assert.ok(done.error.includes('超时'), '错误信息含"超时"');
  } finally { await stop(s); }
});

test('C6 面数上限：超 50K 三角面判失败', async () => {
  const s = await startTest({
    maxTriangles: 50000,
    hyper3dApi: fakeApi({ triangles: 60000 }),
  });
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    const done = await waitGen(s._base, g.data.taskId);
    assert.strictEqual(done.status, 'failed');
    assert.ok(done.error.includes('面数过多'));
  } finally { await stop(s); }
});

test('C7 照片用完即删：生成完成后原图不保留', async () => {
  const s = await startTest();
  try {
    const up = await uploadPhoto(s._base);
    const photoPath = path.join(s.config.dataDir, 'uploads', path.basename(up.previewUrl));
    assert.ok(fs.existsSync(photoPath));
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    await waitGen(s._base, g.data.taskId);
    assert.ok(!fs.existsSync(photoPath), '生成后照片文件应被删除');
  } finally { await stop(s); }
});

// ---------- D. 物件 CRUD ----------
test('D1 放置物件并按房间列出', async () => {
  const s = await startTest();
  try {
    const body = { id: 'o1', name: '花瓶', url: '/models/sample.glb', x: 1, y: 0, z: 2, rotY: 45, scale: 1, owner: 'A', ownerName: '小明', room: 'main' };
    const p = await req(s._base, 'POST', '/api/objects', { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.strictEqual(p.status, 200);
    assert.strictEqual(p.data.name, '花瓶');
    const list = await req(s._base, 'GET', '/api/objects?room=main');
    assert.strictEqual(list.data.length, 1);
    const other = await req(s._base, 'GET', '/api/objects?room=other');
    assert.strictEqual(other.data.length, 0);
  } finally { await stop(s); }
});

test('D2 归属：非上传者不能搬/删（403），上传者可（200）', async () => {
  const s = await startTest();
  try {
    await req(s._base, 'POST', '/api/objects', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'o1', name: '桌', url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', room: 'main' }),
    });
    // 别人搬 → 403
    let r = await req(s._base, 'PUT', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'B', x: 5, y: 0, z: 5, rotY: 0, scale: 1 }),
    });
    assert.strictEqual(r.status, 403);
    // 别人删 → 403
    r = await req(s._base, 'DELETE', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'B' }),
    });
    assert.strictEqual(r.status, 403);
    // 本人搬 → 200
    r = await req(s._base, 'PUT', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'A', x: 5, y: 0, z: 5, rotY: 0, scale: 1 }),
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.x, 5);
    // 本人删 → 200
    r = await req(s._base, 'DELETE', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'A' }),
    });
    assert.strictEqual(r.status, 200);
  } finally { await stop(s); }
});

test('D3 每人上限 20：第 21 个被拒', async () => {
  const s = await startTest();
  try {
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const r = await req(s._base, 'POST', '/api/objects', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'o' + i, url: '/models/sample.glb', x: i, y: 0, z: 0, owner: 'A', room: 'main' }),
      });
      lastStatus = r.status;
    }
    assert.strictEqual(lastStatus, 400, '第 21 个应被拒');
  } finally { await stop(s); }
});

test('D4 最后写入胜出：旧时间戳的移动被忽略', async () => {
  const s = await startTest();
  try {
    await req(s._base, 'POST', '/api/objects', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'o1', url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', room: 'main' }),
    });
    const now = Date.now();
    // 新写入（生效）
    let r = await req(s._base, 'PUT', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'A', x: 100, y: 0, z: 0, rotY: 0, scale: 1, updatedAt: now + 1000 }),
    });
    assert.strictEqual(r.data.x, 100);
    // 旧写入（被忽略）
    r = await req(s._base, 'PUT', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'A', x: 999, y: 0, z: 0, rotY: 0, scale: 1, updatedAt: now - 5000 }),
    });
    assert.strictEqual(r.data.x, 100, '过期写入应被忽略');
  } finally { await stop(s); }
});

test('D5 名字防 XSS：HTML 标签被清除', async () => {
  const s = await startTest();
  try {
    const p = await req(s._base, 'POST', '/api/objects', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'o1', name: '<script>alert(1)</script>花瓶', url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', ownerName: '<img src=x>', room: 'main' }),
    });
    assert.strictEqual(p.status, 200);
    assert.ok(!p.data.name.includes('<'), '名字不应含 <');
    assert.ok(p.data.name.includes('花瓶'));
    assert.ok(!p.data.ownerName.includes('<'));
  } finally { await stop(s); }
});

// ---------- E. 房间 ----------
test('E1 创建房间并列出', async () => {
  const s = await startTest();
  try {
    const r = await req(s._base, 'POST', '/api/rooms', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '二层展厅' }),
    });
    assert.strictEqual(r.status, 200);
    const list = await req(s._base, 'GET', '/api/rooms');
    assert.ok(list.data.some((x) => x.name === '二层展厅'));
  } finally { await stop(s); }
});

// ---------- F. 持久化 ----------
test('F1 重启后物件/房间/日志保留', async () => {
  const dataDir = tmpDir();
  const baseCfg = { dataDir, adminPassword: 'testpass', authSecret: 's' };
  let s = await startTest(baseCfg);
  await req(s._base, 'POST', '/api/objects', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'persist1', name: '古董钟', url: '/models/sample.glb', x: 1, y: 0, z: 1, owner: 'A', room: 'main' }),
  });
  await req(s._base, 'POST', '/api/rooms', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '持久化房间' }),
  });
  await s.store._flush();
  await stop(s);

  // 重启（同一数据目录）
  s = await startTest(baseCfg);
  try {
    const list = await req(s._base, 'GET', '/api/objects?room=main');
    assert.strictEqual(list.data.length, 1);
    assert.strictEqual(list.data[0].name, '古董钟');
    const rooms = await req(s._base, 'GET', '/api/rooms');
    assert.ok(rooms.data.some((x) => x.name === '持久化房间'));
    const actions = s.store.logs.map((l) => l.action);
    assert.ok(actions.includes('place'), '日志应保留 place，实际: ' + actions.join(','));
  } finally { await stop(s); }
});

test('F2 原子写：并发写入文件不损坏', async () => {
  const store = new DataStore(tmpDir());
  const jobs = [];
  for (let i = 0; i < 30; i++) {
    jobs.push(store.addObject({ id: 'c' + i, url: '/models/sample.glb', owner: 'A', room: 'main' }));
  }
  await Promise.all(jobs);
  await store._flush();
  const parsed = JSON.parse(fs.readFileSync(store.objectsFile, 'utf-8'));
  assert.strictEqual(parsed.length, 30, '文件应为完整 30 条');
  assert.ok(!fs.existsSync(store.objectsFile + '.tmp'), '不应残留 .tmp');
});

// ---------- G. 管理员 ----------
test('G1 登录：密码错误 401，正确返回 token', async () => {
  const s = await startTest();
  try {
    let r = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    assert.strictEqual(r.status, 401);
    r = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'testpass' }),
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.token);
  } finally { await stop(s); }
});

test('G2 登录限速：连错 11 次返回 429', async () => {
  const s = await startTest();
  try {
    let got429 = false;
    for (let i = 0; i < 11; i++) {
      const r = await req(s._base, 'POST', '/api/admin/login', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'nope' }),
      });
      if (r.status === 429) { got429 = true; break; }
    }
    assert.ok(got429, '连错多次应被限速');
  } finally { await stop(s); }
});

test('G3 后台接口需要 token：无 token 401，有 token 200', async () => {
  const s = await startTest();
  try {
    let r = await req(s._base, 'GET', '/api/admin/logs');
    assert.strictEqual(r.status, 401);
    const login = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'testpass' }),
    });
    const token = login.data.token;
    r = await req(s._base, 'GET', '/api/admin/logs', { headers: { authorization: 'Bearer ' + token } });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.data));
    // 伪造 token → 401
    r = await req(s._base, 'GET', '/api/admin/logs', { headers: { authorization: 'Bearer fake.token.here' } });
    assert.strictEqual(r.status, 401);
  } finally { await stop(s); }
});

test('G4 操作日志已记录（上传/生成/放置/删除）', async () => {
  const s = await startTest();
  try {
    const up = await uploadPhoto(s._base);
    const g = await req(s._base, 'POST', '/api/generate', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: up.photoId, room: 'main', owner: 'A' }),
    });
    // 等生成任务完成（generate_done 日志是异步写的）
    await waitGen(s._base, g.data.taskId);
    await req(s._base, 'POST', '/api/objects', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'o1', url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', room: 'main' }),
    });
    await req(s._base, 'DELETE', '/api/objects/o1', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'A' }),
    });
    const login = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'testpass' }),
    });
    const logs = await req(s._base, 'GET', '/api/admin/logs', { headers: { authorization: 'Bearer ' + login.data.token } });
    const actions = logs.data.map((l) => l.action);
    for (const a of ['upload', 'generate_start', 'generate_done', 'place', 'delete', 'login_ok']) {
      assert.ok(actions.includes(a), '应含日志 ' + a + '，实际: ' + actions.join(','));
    }
  } finally { await stop(s); }
});

test('G5 后台合并查看：多个房间物件同时返回（不搬动）', async () => {
  const s = await startTest();
  try {
    await req(s._base, 'POST', '/api/rooms', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'r1' }) });
    await req(s._base, 'POST', '/api/rooms', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'r2' }) });
    for (const [id, room] of [['a1', 'r1'], ['a2', 'r1'], ['b1', 'r2']]) {
      await req(s._base, 'POST', '/api/objects', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', room }),
      });
    }
    const login = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'testpass' }),
    });
    const merged = await req(s._base, 'GET', '/api/admin/merge?rooms=r1,r2', { headers: { authorization: 'Bearer ' + login.data.token } });
    assert.strictEqual(merged.data.length, 3, 'r1+r2 共 3 个物件');
    const ids = merged.data.map((o) => o.id).sort();
    assert.deepStrictEqual(ids, ['a1', 'a2', 'b1']);
    // 原房间物件仍在
    const r1 = await req(s._base, 'GET', '/api/objects?room=r1');
    assert.strictEqual(r1.data.length, 2, '合并只是查看，未搬动');
  } finally { await stop(s); }
});

test('G6 管理员可删任意物件', async () => {
  const s = await startTest();
  try {
    await req(s._base, 'POST', '/api/objects', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'o1', url: '/models/sample.glb', x: 0, y: 0, z: 0, owner: 'A', room: 'main' }),
    });
    const login = await req(s._base, 'POST', '/api/admin/login', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'testpass' }),
    });
    const r = await req(s._base, 'DELETE', '/api/admin/objects/o1', { headers: { authorization: 'Bearer ' + login.data.token } });
    assert.strictEqual(r.status, 200);
    const list = await req(s._base, 'GET', '/api/objects?room=main');
    assert.strictEqual(list.data.length, 0);
  } finally { await stop(s); }
});

// ---------- H. Socket 多人 ----------
function connect(base) {
  return ioClient(base, { transports: ['websocket'], reconnection: false, timeout: 2000 });
}
// 带超时的事件等待，防止事件错过导致测试挂死
function onceWithTimeout(emitter, evt, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('等待事件 ' + evt + ' 超时')), ms);
    emitter.once(evt, (data) => { clearTimeout(t); resolve(data); });
  });
}
function connectReady(base) {
  const c = connect(base);
  return Promise.all([
    new Promise((r) => c.on('connect', r)),
  ]).then(() => c);
}

test('H1 玩家加入：名字净化 + joined 事件 + 广播', async () => {
  const s = await startTest();
  try {
    const c2 = await connectReady(s._base); // 先加入，才能收到别人的广播
    const c1 = await connectReady(s._base);
    const joined2 = onceWithTimeout(c2, 'joined');
    c2.emit('join', { name: '小蓝', room: 'main', color: '#00ff00' });
    await joined2;
    const sawJoin = onceWithTimeout(c2, 'player-joined');
    const joined1 = onceWithTimeout(c1, 'joined');
    c1.emit('join', { name: '<b>小红</b>', room: 'main', color: '#ff0000' });
    await joined1;
    // 服务端存的玩家名已净化
    const p1 = s.players[c1.id];
    assert.ok(p1, '玩家已登记');
    assert.ok(!p1.name.includes('<'), '名字已净化');
    assert.ok(p1.name.includes('小红'));
    assert.strictEqual(p1.color, '#ff0000');
    // 房间内其他玩家收到 player-joined
    const evt = await sawJoin;
    assert.strictEqual(evt.name, '小红');
    c1.disconnect(); c2.disconnect();
  } finally { await stop(s); }
});

test('H2 移动广播：其他玩家收到 player-move', async () => {
  const s = await startTest();
  try {
    const c1 = await connectReady(s._base);
    const c2 = await connectReady(s._base);
    const j1 = onceWithTimeout(c1, 'joined');
    c1.emit('join', { name: '甲', room: 'main' });
    await j1;
    const j2 = onceWithTimeout(c2, 'joined');
    c2.emit('join', { name: '乙', room: 'main' });
    await j2;
    const moveEvt = onceWithTimeout(c2, 'player-move');
    c1.emit('move', { x: 10, y: 1.5, z: 20, yaw: 45, pitch: -10 });
    const m = await moveEvt;
    assert.strictEqual(m.id, c1.id);
    assert.strictEqual(m.x, 10);
    assert.strictEqual(m.z, 20);
    c1.disconnect(); c2.disconnect();
  } finally { await stop(s); }
});

test('H3 满员：超过上限的新玩家收到 full', async () => {
  const s = await startTest({ maxPlayers: 2 });
  try {
    const c1 = await connectReady(s._base);
    const c2 = await connectReady(s._base);
    const c3 = await connectReady(s._base);
    const j1 = onceWithTimeout(c1, 'joined');
    c1.emit('join', { name: 'a', room: 'main' });
    await j1;
    const j2 = onceWithTimeout(c2, 'joined');
    c2.emit('join', { name: 'b', room: 'main' });
    await j2;
    const full = onceWithTimeout(c3, 'full');
    c3.emit('join', { name: 'c', room: 'main' });
    const f = await full;
    assert.strictEqual(f.max, 2);
    assert.ok(!s.players[c3.id], '第 3 个玩家不应被登记');
    c1.disconnect(); c2.disconnect(); c3.disconnect();
  } finally { await stop(s); }
});
