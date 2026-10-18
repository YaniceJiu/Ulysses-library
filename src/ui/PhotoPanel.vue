<template>
  <div class="panel photo-panel">
    <button class="close" @click="$emit('close')">✕</button>
    <h3>📷 拍一个物件放进展厅</h3>
    <p class="tip">对着你的物件拍一张（≤{{ limitMb }}MB），AI 会生成 3D 模型放进建筑</p>
    <div class="row">
      <input ref="fileInput" type="file" accept="image/*" capture="environment" style="display:none" @change="onFile" />
      <button @click="pick">📷 拍照 / 选照片</button>
    </div>
    <div v-if="store.photoPreview" class="preview"><img :src="store.photoPreview" alt="预览" /></div>
    <div v-if="store.generating" class="gen">
      <div class="spinner"></div>
      <p v-if="!(store.genStatus && store.genStatus.status === 'failed')">AI 生成中，请稍候…（一般几十秒）</p>
      <p v-else class="err">😢 {{ store.genStatus.error || '生成失败' }}</p>
      <button v-if="store.genStatus && store.genStatus.status === 'failed'" @click="store.generating = false">🔄 重拍</button>
    </div>
    <div v-else class="row">
      <button :disabled="!store.photoPreview" @click="generate">✨ 用这张生成 3D</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { store } from '../store';
import { api } from '../api';

const fileInput = ref(null);
let photoFile = null;
const limitMb = computed(() => store.cfg.maxPhotoMb || 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pick() {
  fileInput.value && fileInput.value.click();
}
function onFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (f.size > (store.cfg.maxPhotoMb || 10) * 1024 * 1024) { alert('照片太大，请重新拍一张'); return; }
  photoFile = f;
  const reader = new FileReader();
  reader.onload = () => { store.photoPreview = reader.result; };
  reader.readAsDataURL(f);
}

async function generate() {
  if (!photoFile) return;
  store.generating = true;
  store.genStatus = { status: 'processing' };
  try {
    const up = await api.uploadPhoto(photoFile);
    const g = await api.generate({
      photoId: up.photoId,
      room: store.room,
      owner: store.playerId,
      ownerName: store.name,
      name: (store.name || '玩家') + ' 的物件',
    });
    // 轮询生成状态
    for (;;) {
      await sleep(1200);
      const st = await api.genStatus(g.taskId);
      if (st.status === 'done') {
        store.placing = {
          url: st.result.url,
          scale: st.result.scale || 1,
          rotY: 0,
          dims: st.result.dimensions,
          phase: 'adjust',
          name: '新物件',
        };
        store.showPhoto = false;
        store.photoPreview = null;
        store.genStatus = null;
        break;
      }
      if (st.status === 'failed') { store.genStatus = { status: 'failed', error: st.error }; break; }
    }
  } catch (err) {
    store.genStatus = { status: 'failed', error: err.message };
  } finally {
    store.generating = false;
  }
}
</script>

<style scoped>
.photo-panel { top: 70px; right: 16px; width: 300px; }
.preview img { width: 100%; border-radius: 8px; margin: 8px 0; }
.spinner {
  width: 36px; height: 36px; border: 4px solid #334155; border-top-color: #1f6feb;
  border-radius: 50%; margin: 12px auto; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.err { color: #f87171; }
.gen { text-align: center; color: #cbd5e1; }
</style>
