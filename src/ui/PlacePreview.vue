<template>
  <!-- 阶段1：调整（面板完全可点，不抢鼠标） -->
  <div v-if="store.placing && store.placing.phase === 'adjust'" class="panel place-panel">
    <button class="close" @click="cancel">✕</button>
    <h3>📍 放置 · 调整</h3>
    <p class="tip">先调好大小/朝向/名字，再点「开始放置」对准位置</p>
    <div ref="pv" class="pv"></div>
    <div class="row"><label>大小</label><input type="range" min="0.3" max="3" step="0.05" v-model="scale" /><span>{{ scale.toFixed(2) }}</span></div>
    <div class="row"><label>旋转</label><input type="range" min="0" max="360" step="5" v-model="rotY" /><span>{{ rotY }}°</span></div>
    <div class="row"><label>名字</label><input v-model="name" type="text" maxlength="12" placeholder="物件名字" /></div>
    <div class="row">
      <button class="go" @click="startPlace">🎯 开始放置</button>
      <button class="cancel" @click="cancel">取消</button>
    </div>
  </div>

  <!-- 阶段2：放置（小提示条，不挡视线；鼠标锁定后物品跟随准星） -->
  <div v-else-if="store.placing && store.placing.phase === 'place'" class="place-bar">
    🎯 移动鼠标对准地面（物品跟随准星）→ <b>点鼠标放置</b> · Esc 取消
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { store } from '../store';
import { worldHolder } from '../world';

const pv = ref(null);
const scale = ref(store.placing ? store.placing.scale || 1 : 1);
const rotY = ref(store.placing ? store.placing.rotY || 0 : 0);
const name = ref(store.placing ? store.placing.name || '新物件' : '新物件');

let renderer = null, scene = null, camera = null, model = null, raf = 0;

// 滑块实时同步到 store.placing，放置阶段幽灵跟着变
watch([scale, rotY], () => {
  if (store.placing) {
    store.placing.scale = scale.value;
    store.placing.rotY = rotY.value;
  }
  apply();
});
watch(name, () => { if (store.placing) store.placing.name = name.value; });

// 进入放置阶段：锁定鼠标，物品跟准星
function startPlace() {
  if (!store.placing) return;
  store.placing.phase = 'place';
  const dom = worldHolder.world && worldHolder.world.renderer.domElement;
  if (dom && dom.requestPointerLock) dom.requestPointerLock();
}

function cancel() {
  store.placing = null;
}

onMounted(() => {
  // 若直接以“放置”阶段挂载（无预览画布），跳过迷你预览初始化
  if (!pv.value) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e293b);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(3, 2.2, 3.4);
  camera.lookAt(0, 0.8, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  pv.value.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
  const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(3, 5, 4); scene.add(d);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.02; scene.add(g);

  if (store.placing && store.placing.url) {
    new GLTFLoader().load(store.placing.url, (gltf) => {
      model = gltf.scene;
      scene.add(model);
      apply();
    });
  }
  const size = () => { const w = pv.value.clientWidth, h = pv.value.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size();
  const loop = () => { raf = requestAnimationFrame(loop); if (model) { model.rotation.y = (rotY.value * Math.PI) / 180 + 0.15; } renderer.render(scene, camera); };
  loop();
  window.addEventListener('resize', size);
  onBeforeUnmount(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); renderer.dispose(); });
});

function apply() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y || 1;
  model.scale.setScalar(scale.value / h);
}
</script>

<style scoped>
.place-panel { bottom: 16px; left: 16px; width: 300px; }
.place-panel .row { justify-content: space-between; }
.pv { width: 100%; height: 200px; background: #0f172a; border-radius: 8px; margin: 8px 0; }
.go { background: #16a34a; }
.cancel { background: #475569; }
.place-bar {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(15,23,42,.9); color: #e2e8f0; padding: 10px 18px; border-radius: 999px;
  font-size: 14px; white-space: nowrap; pointer-events: none; z-index: 20;
}
</style>
