/** 生成本地演示模型 models/sample.glb（未配 AI key 时用于跑通全流程） */
const fs = require('fs');
const path = require('path');

// Node 缺 FileReader，给 GLTFExporter 补一个（基于 Blob.arrayBuffer）
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class FileReader {
    constructor() { this.result = null; }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(buf).toString('base64');
        if (this.onloadend) this.onloadend({ target: this });
      });
    }
  };
}

const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');

const scene = new THREE.Scene();
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });

// 一个小雕塑：底座 + 柱 + 球（高度约 2 格）
const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), mat(0x8a7f6d));
base.position.y = 0.15;
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.0, 16), mat(0xc9a227));
pillar.position.y = 0.8;
const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), mat(0x4a90d9));
top.position.y = 1.55;
scene.add(base, pillar, top);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltf) => {
    const out = path.join(__dirname, '..', 'models', 'sample.glb');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(gltf));
    console.log('已生成', out, (gltf.byteLength / 1024).toFixed(1) + 'KB');
  },
  (err) => { console.error('导出失败', err); process.exit(1); },
  { binary: true }
);
