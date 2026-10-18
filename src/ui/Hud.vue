<template>
  <div class="hud">
    <div v-if="showHint && !store.locked" class="enter-hint">
      <b>欢迎来到图书馆，{{ store.name }}</b>
      <p>电脑 WASD 行走；手机按住方向键移动（可同时按两个方向斜走），在空白画面滑动转向，点“跳”键跳跃。</p>
      <p>把准星对准楼面，点击“放置图钉”；点中自己的图钉可移动、拍照或删除。</p>
      <button @click="showHint = false">知道了</button>
    </div>

    <div v-if="!store.locked" class="topbar">
      <span class="pill">👥 {{ store.online }}</span>
      <span class="pill">📍 {{ myPinCount }}/5</span>
      <span class="pill">{{ store.name }}</span>
      <span v-if="store.role === 'player' && store.settings.sharedGhost" class="pill">👻 全局幽灵模式</span>
      <button class="pill-btn primary" :disabled="myPinCount >= 5" @click="placePin">📍 放置图钉</button>
      <button v-if="store.role === 'admin'" class="pill-btn" @click="store.showBoard = true">📋 管理 Board</button>
      <button v-if="store.role === 'admin'" class="pill-btn" :class="{ active: store.ghost }" @click="toggleGhost">
        👻 {{ store.ghost ? '关闭本地幽灵' : '本地幽灵' }}
      </button>
      <button v-if="store.role === 'admin'" class="pill-btn" :class="{ active: store.settings.sharedGhost }" @click="toggleSharedGhost">
        {{ store.settings.sharedGhost ? '关闭全员幽灵' : '开启全员幽灵' }}
      </button>
      <button v-if="store.role === 'admin'" class="pill-btn" :class="{ active: store.settings.sharePins }" @click="toggleSharing">
        {{ store.settings.sharePins ? '隐藏他人图钉' : '向玩家显示图钉' }}
      </button>
      <button class="pill-btn" @click="signOut">退出</button>
    </div>

    <div v-if="store.locked || store.placingPin || store.movingPin" class="reticle">+</div>
    <div v-if="store.placingPin || store.movingPin" class="action-tip">
      {{ store.placingPin ? '对准可行走的楼面并点击放置图钉 · Esc 取消' : '对准新的楼面位置并点击移动图钉 · Esc 取消' }}
      <button @click="cancelAction">取消</button>
    </div>
    <div v-if="store.error" class="toast" @click="store.error = ''">{{ store.error }}　×</div>

    <div v-if="!store.locked" class="touch-pad">
      <div class="pad-arrows">
        <button @pointerdown.prevent="press('w')" @pointerup.prevent="release('w')" @pointerleave="release('w')" @pointercancel="release('w')">↑</button>
        <div>
          <button @pointerdown.prevent="press('a')" @pointerup.prevent="release('a')" @pointerleave="release('a')" @pointercancel="release('a')">←</button>
          <button @pointerdown.prevent="press('s')" @pointerup.prevent="release('s')" @pointerleave="release('s')" @pointercancel="release('s')">↓</button>
          <button @pointerdown.prevent="press('d')" @pointerup.prevent="release('d')" @pointerleave="release('d')" @pointercancel="release('d')">→</button>
        </div>
      </div>
      <button class="jump" @pointerdown.prevent="press(' ')" @pointerup.prevent="release(' ')" @pointerleave="release(' ')" @pointercancel="release(' ')">跳</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { store } from '../store';
import { api } from '../api';
import { worldHolder } from '../world';

const showHint = ref(true);
const myPinCount = computed(() => store.pins.filter((pin) => pin.ownerId === store.user.id).length);
const pressedKeys = new Set();
let hintTimer;

onMounted(() => { hintTimer = setTimeout(() => { showHint.value = false; }, 9000); });
onBeforeUnmount(() => { clearTimeout(hintTimer); release(); });

function placePin() {
  if (myPinCount.value >= 5) return;
  store.error = '';
  store.selectedPin = null;
  store.placingPin = true;
  worldHolder.world && worldHolder.world.requestPointerLock();
}

function cancelAction() {
  store.placingPin = false;
  store.movingPin = null;
  if (document.pointerLockElement) document.exitPointerLock();
}

function toggleGhost() {
  store.ghost = !store.ghost;
  if (worldHolder.world) worldHolder.world.setGhost(store.ghost || store.settings.sharedGhost);
}

async function toggleSharedGhost() {
  try {
    store.settings = await api.updateSettings({ sharedGhost: !store.settings.sharedGhost });
  } catch (error) { store.error = error.message; }
}

async function toggleSharing() {
  try {
    store.settings = await api.updateSettings({ sharePins: !store.settings.sharePins });
    store.pins = await api.pins();
  } catch (error) { store.error = error.message; }
}

function press(key) {
  pressedKeys.add(key);
  if (worldHolder.world) worldHolder.world.keys[key] = true;
}

function release(key) {
  const keys = key ? [key] : [...pressedKeys];
  for (const pressedKey of keys) {
    if (worldHolder.world) worldHolder.world.keys[pressedKey] = false;
    pressedKeys.delete(pressedKey);
  }
}

async function signOut() {
  try { await api.logout(); } finally { location.reload(); }
}
</script>

<style scoped>
.hud { position: absolute; inset: 0; pointer-events: none; }
.topbar { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 96vw; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 14px; background: #080d0dcc; color: #eef5ee; pointer-events: auto; font-size: 12px; }
.pill { padding: 5px 8px; border-radius: 999px; background: #ffffff1b; white-space: nowrap; }
.pill-btn { padding: 7px 9px; font-size: 12px; background: #34423f; }
.pill-btn.primary { background: #16745d; }
.pill-btn.active { background: #7c3aed; }
.reticle { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #fff; font-size: 24px; text-shadow: 0 1px 3px #000; }
.enter-hint,.action-tip,.toast { position: absolute; left: 50%; transform: translateX(-50%); z-index: 30; pointer-events: auto; color: #f2f5f4; background: #101923eb; padding: 14px 18px; border-radius: 12px; box-shadow: 0 5px 24px #0006; }
.enter-hint { top: 32%; width: min(92vw,440px); text-align: center; }
.enter-hint p { margin: 8px 0; color: #bdc9c2; font-size: 13px; line-height: 1.6; }
.action-tip { bottom: 20%; display: flex; align-items: center; gap: 10px; white-space: nowrap; font-size: 13px; }
.toast { top: 82px; max-width: 90vw; background: #7f1d1d; }
.touch-pad { position: absolute; bottom: max(18px,env(safe-area-inset-bottom)); left: 16px; display: flex; align-items: end; gap: 26px; pointer-events: auto; touch-action: none; }
.pad-arrows { display: grid; justify-items: center; gap: 4px; }
.pad-arrows div { display: flex; gap: 4px; }
.touch-pad button { width: 48px; height: 46px; padding: 0; background: #111c;color: white; font-size: 20px; border: 1px solid #ffffff55; touch-action: none; user-select: none; }
.touch-pad .jump { width: 62px; height: 62px; border-radius: 50%; background: #16745ddd; font-size: 15px; }
@media (pointer:fine) { .touch-pad { opacity: .62; } }
</style>
