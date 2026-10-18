/** Hyper3D Rodin 图片转 3D 真实 API 适配（未配 key 时走 DemoApi） */
const fs = require('fs');

class RodinApi {
  constructor(config) {
    this.config = config;
    this.base = (config.hyper3dBaseUrl || 'https://api.hyper3d.ai').replace(/\/$/, '');
  }

  _headers() {
    return { Authorization: 'Bearer ' + this.config.hyper3dApiKey };
  }

  async create(photoPath) {
    if (!this.config.hyper3dApiKey) throw new Error('未配置 HYPER3D_API_KEY');
    const buf = await fs.promises.readFile(photoPath);
    const fd = new FormData();
    fd.append('file', new Blob([buf]), 'photo.png');
    const res = await fetch(this.base + '/v1/image-to-3d', {
      method: 'POST',
      headers: this._headers(),
      body: fd,
    });
    if (!res.ok) throw new Error('Rodin 提交失败 HTTP ' + res.status);
    const data = await res.json();
    if (!data.task_id) throw new Error('Rodin 未返回 task_id');
    return { remoteId: data.task_id };
  }

  async poll(remoteId) {
    const res = await fetch(this.base + '/v1/tasks/' + remoteId, {
      headers: this._headers(),
    });
    if (!res.ok) throw new Error('Rodin 查询失败 HTTP ' + res.status);
    const data = await res.json();
    const status = data.status; // pending / running / succeeded / failed
    if (status === 'succeeded') {
      const url =
        (data.output && data.output.model && data.output.model.glb_url) ||
        (data.task_result && data.task_result.model_urls && data.task_result.model_urls.glb) ||
        (data.task_result && data.task_result.model && data.task_result.model.url) ||
        null;
      if (!url) throw new Error('Rodin 完成但无模型地址');
      return {
        status: 'done',
        result: { url, dimensions: { x: 1, y: 1, z: 1 }, triangles: 0 },
      };
    }
    if (status === 'failed') return { status: 'failed', error: data.error || 'Rodin 生成失败' };
    return { status: 'running' };
  }
}

module.exports = { RodinApi };
