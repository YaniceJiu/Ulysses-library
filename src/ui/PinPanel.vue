<template>
  <section class="panel pin-panel">
    <button class="close" @click="store.selectedPin = null">关闭</button>
    <h3>📍 {{ pin.ownerName }} 的图钉</h3>
    <p>位置：X {{ pin.x.toFixed(1) }} · Y {{ pin.y.toFixed(1) }} · Z {{ pin.z.toFixed(1) }}</p>
    <img v-if="pin.photo" :src="pin.photoUrl" alt="图钉照片" />
    <p v-else class="tip">还没有照片</p>
    <div v-if="pin.ownerId === store.user.id && store.role === 'player'" class="actions">
      <button @click="store.showPhoto = true">📷 拍照</button>
      <button @click="move">移动</button>
      <button class="danger" @click="remove">删除</button>
    </div>
    <p v-else-if="store.role === 'player'" class="tip">你只能编辑自己的图钉。</p>
  </section>
</template>

<script setup>
import { store } from '../store';
import { api } from '../api';
import { worldHolder } from '../world';

const props = defineProps({ pin: { type: Object, required: true } });

function move() {
  store.error = '';
  store.selectedPin = null;
  store.movingPin = props.pin.id;
  worldHolder.world && worldHolder.world.requestPointerLock();
}

async function remove() {
  if (!confirm('删除这枚图钉及其照片？')) return;
  try {
    await api.deletePin(props.pin.id);
    store.pins = store.pins.filter((pin) => pin.id !== props.pin.id);
    store.selectedPin = null;
  } catch (error) { store.error = error.message; }
}
</script>

<style scoped>
.pin-panel { top: 78px; right: 14px; width: min(310px, calc(100vw - 28px)); }
.pin-panel img { display: block; width: 100%; max-height: 38vh; object-fit: contain; margin: 12px 0; border-radius: 8px; background: #080d12; }
.pin-panel p { margin: 8px 0; color: #cbd5e1; font-size: 13px; }
.actions { display: flex; gap: 7px; flex-wrap: wrap; }
</style>
