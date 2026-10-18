<template>
  <div class="shade">
    <section class="panel photo-panel">
      <button class="close" @click="$emit('close')">关闭</button>
      <h3>为图钉拍照</h3>
      <video v-if="!capturedUrl" ref="video" autoplay playsinline muted></video>
      <img v-else :src="capturedUrl" alt="照片预览" />
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button v-if="!capturedUrl" @click="capture" :disabled="!stream">拍摄</button>
        <template v-else>
          <button @click="retake">重拍</button>
          <button class="primary" @click="save" :disabled="saving">{{ saving ? '上传中…' : '保存照片' }}</button>
        </template>
      </div>
      <p class="tip">使用后置摄像头；照片保存到你的图钉，可在解锁后重拍或删除。</p>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { store } from '../store';
import { api } from '../api';

const props = defineProps({ pin: { type: Object, required: true } });
defineEmits(['close']);
const video = ref(null);
const capturedUrl = ref('');
const error = ref('');
const saving = ref(false);
let stream = null;
let capturedBlob = null;

onMounted(async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('此浏览器不支持网页相机，请使用支持 HTTPS 的新版浏览器。');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
      audio: false,
    });
    if (video.value) video.value.srcObject = stream;
  } catch (err) {
    error.value = err.name === 'NotAllowedError'
      ? '相机权限被拒绝。请在浏览器设置中允许相机访问后重试。'
      : err.message || '无法打开相机。';
  }
});

function capture() {
  const source = video.value;
  if (!source || !source.videoWidth) {
    error.value = '相机尚未就绪，请稍候再试。';
    return;
  }
  const scale = Math.min(1, 1600 / source.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.videoWidth * scale);
  canvas.height = Math.round(source.videoHeight * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) { error.value = '照片生成失败，请重拍。'; return; }
    capturedBlob = blob;
    capturedUrl.value = URL.createObjectURL(blob);
    error.value = '';
  }, 'image/jpeg', 0.86);
}

function retake() {
  if (capturedUrl.value) URL.revokeObjectURL(capturedUrl.value);
  capturedUrl.value = '';
  capturedBlob = null;
}

async function save() {
  if (!capturedBlob) return;
  saving.value = true;
  error.value = '';
  try {
    const pin = await api.uploadPinPhoto(props.pin.id, capturedBlob);
    const index = store.pins.findIndex((item) => item.id === pin.id);
    if (index >= 0) store.pins[index] = pin;
    store.selectedPin = pin;
    store.showPhoto = false;
  } catch (err) {
    error.value = err.message || '照片上传失败，请重试。';
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (capturedUrl.value) URL.revokeObjectURL(capturedUrl.value);
});
</script>

<style scoped>
.shade { position: absolute; inset: 0; z-index: 70; display: grid; place-items: center; padding: 14px; background: #0009; pointer-events: auto; }
.photo-panel { position: relative; width: min(94vw,500px); max-height: 92vh; }
video,.photo-panel img { display: block; width: 100%; max-height: 58vh; object-fit: contain; background: #05080b; border-radius: 9px; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.actions button { flex: 1; }
.primary { background: #16745d; }
.tip { margin-top: 10px; color: #aebbb5; font-size: 12px; line-height: 1.5; }
.error { color: #ff9e92; margin: 8px 0; }
</style>
