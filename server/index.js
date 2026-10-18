/** 服务器入口：读 .env → 启动 */
const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ADMIN_PASSWORD || config.adminPassword.length < 16) {
    throw new Error('生产环境必须设置至少 16 位的 ADMIN_PASSWORD');
  }
  if (!process.env.AUTH_SECRET || config.authSecret.length < 32) {
    throw new Error('生产环境必须设置至少 32 位的 AUTH_SECRET');
  }
}
const server = createApp(config);
server.start().then(() => {
  console.log('==========================================');
  console.log('  Minecraft 建筑展厅已启动');
  console.log('  本地访问 : http://localhost:' + config.port);
  console.log('  后台管理 : http://localhost:' + config.port + '/admin/');
  console.log('  管理员账号: ' + config.adminUsername);
  console.log('  运行模式  : ' + (config.enableLegacyFeatures ? '兼容测试' : '图钉展厅'));
  console.log('==========================================');
});
