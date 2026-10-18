<template>
  <div class="panel obj-menu">
    <h3>📦 {{ store.selectedObject.name }}</h3>
    <p class="tip">上传者：{{ store.selectedObject.ownerName || '未知' }} · 第 {{ size }} 格高</p>
    <div v-if="isMine" class="row">
      <label>大小</label>
      <input type="range" min="0.3" max="3" step="0.05" v-model="scale" />
      <span>{{ scale.toFixed(2) }}</span>
    </div>
    <div v-if="isMine" class="row">
      <label>旋转</label>
      <input type="range" min="0" max="360" step="5" v-model="rotY" />
      <span>{{ rotY }}°</span>
    </div>
    <div class="row">
      <button v-if="isMine" @click="move" title="快捷键 G">✋ 搬动 <kbd>G</kbd></button>
      <button v-if="isMine" class="danger" @click="del" title="快捷键 Del">🗑 删除 <kbd>Del</kbd></button>
      <button @click="close" title="快捷键 Esc">关闭 <kbd>Esc</kbd></button>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { store } from '../store';
import { api } from '../api';
import { worldHolder } from '../world';

const isMine = computed(() => store.selectedObject && store.selectedObject.owner === store.playerId);
const size = computed(() => (store.selectedObject && store.selectedObject.scale ? store.selectedObject.scale.toFixed(1) : '1'));

// 滑块直接改 store 里的对象（3D 实时刷新）
const scale = computed({
  get: () => (store.selectedObject ? (store.selectedObject.scale || 1) : 1),
  set: (v) => { if (store.selectedObject) store.selectedObject.scale = v; },
});
const rotY = computed({
  get: () => (store.selectedObject ? (store.selectedObject.rotY || 0) : 0),
  set: (v) => { if (store.selectedObject) store.selectedObject.rotY = v; },
});

watch(() => {
  const o = store.selectedObject;
  return o && [o.scale, o.rotY];
}, () => refresh());

function refresh() {
  const w = worldHolder.world;
  const obj = store.selectedObject;
  if (w && w.objects && obj) w.objects.refreshTransform(obj);
}

function move() {
  worldHolder.world.startMove(store.selectedObject);
}
async function del() {
  if (!confirm('确定删除这个物件？')) return;
  try {
    await api.deleteObject(store.selectedObject.id, store.playerId);
    // socket 会广播移除
  } catch (e) { alert(e.message); }
  store.selectedObject = null;
}
function close() { store.selectedObject = null; }

// 键盘快捷键：Esc 关闭 · Del/Backspace 删除 · G 搬动
function onKey(e) {
  if (!store.selectedObject) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (isMine.value) { e.preventDefault(); del(); }
  } else if ((e.key === 'g' || e.key === 'G' || e.key === 'm' || e.key === 'M') && isMine.value) {
    e.preventDefault(); move();
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.obj-menu { bottom: 120px; left: 50%; transform: translateX(-50%); min-width: 260px; text-align: center; }
.obj-menu .row { justify-content: space-between; margin-bottom: 8px; }
.obj-menu label { font-size: 13px; color: #cbd5e1; }
.obj-menu input[type="range"] { flex: 1; margin: 0 8px; }
.obj-menu kbd { background: #334155; border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-left: 2px; }
</style>
