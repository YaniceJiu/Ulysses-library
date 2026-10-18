/**
 * 演示生成 API（未配置 HYPER3D_API_KEY 时用）：
 * 跑通「拍照→生成→放置」全流程，返回一个内置示例模型。
 * 不产生真实 AI 生成，仅供本地开发/测试。
 */
const { sleep } = require('./hyper3d');

class DemoApi {
  constructor(config) {
    this.config = config;
  }

  async create(photoPath) {
    await sleep(200);
    return { remoteId: 'demo-' + Date.now() };
  }

  async poll(remoteId) {
    await sleep(400);
    return {
      status: 'done',
      result: {
        url: '/models/sample.glb',
        dimensions: { x: 1, y: 2, z: 1 }, // 高 2 格，方便演示自动缩放
        triangles: 1200,
      },
    };
  }
}

module.exports = { DemoApi };
