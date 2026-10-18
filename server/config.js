/** 配置加载：读 .env + 允许程序化覆盖（测试用） */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 只在根目录存在 .env 时加载（测试环境可跳过）
dotenv.config();

function loadConfig(overrides = {}) {
  const root = path.resolve(__dirname, '..');
  const dataDir = overrides.dataDir || process.env.DATA_DIR || root;
  fs.mkdirSync(dataDir, { recursive: true });

  const env = (key, def) => {
    const v = process.env[key];
    return v === undefined || v === '' ? def : v;
  };

  const config = {
    root,
    dataDir,
    port: Number(overrides.port ?? env('PORT', 8900)),
    adminPassword: overrides.adminPassword ?? env('ADMIN_PASSWORD', 'admin123'),
    adminUsername: overrides.adminUsername ?? env('ADMIN_USERNAME', 'JaniceJiu'),
    authSecret: overrides.authSecret ?? env('AUTH_SECRET', 'mc-walkthrough-secret'),
    hyper3dApiKey: overrides.hyper3dApiKey ?? env('HYPER3D_API_KEY', ''),
    hyper3dBaseUrl: overrides.hyper3dBaseUrl ?? env('HYPER3D_BASE_URL', 'https://api.hyper3d.ai'),
    maxPlayers: Number(overrides.maxPlayers ?? env('MAX_PLAYERS', 50)),
    maxObjectsPerPlayer: Number(overrides.maxObjectsPerPlayer ?? env('MAX_OBJECTS_PER_PLAYER', 20)),
    maxPhotoMb: Number(overrides.maxPhotoMb ?? env('MAX_PHOTO_MB', 10)),
    maxTriangles: Number(overrides.maxTriangles ?? env('MAX_TRIANGLES', 50000)),
    genTimeoutMs: Number(overrides.genTimeoutMs ?? env('GEN_TIMEOUT_MS', 120000)),
    genRetries: Number(overrides.genRetries ?? env('GEN_RETRIES', 2)),
    targetHeight: Number(overrides.targetHeight ?? env('TARGET_HEIGHT', 1.6)),
    enableLegacyFeatures: overrides.enableLegacyFeatures ??
      env('ENABLE_LEGACY_FEATURES', 'false').toLowerCase() === 'true',
    trustProxy: overrides.trustProxy ?? env('TRUST_PROXY', 'false').toLowerCase() === 'true',
    pollMs: Number(overrides.pollMs ?? 1500),
    retryBackoffMs: Number(overrides.retryBackoffMs ?? 2000),
    // 可注入项（测试用）
    hyper3dClient: overrides.hyper3dClient || null,
    hyper3dApi: overrides.hyper3dApi || null,
  };
  return config;
}

module.exports = { loadConfig };
