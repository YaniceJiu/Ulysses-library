<template>
  <StartScreen v-if="store.screen === 'start'" @submit="authenticate" />
  <template v-else>
    <div ref="mount" class="scene-mount"></div>
    <Hud />
    <PinPanel v-if="store.selectedPin" :pin="store.selectedPin" />
    <PinPhotoPanel v-if="store.showPhoto && store.selectedPin" :pin="store.selectedPin"
      @close="store.showPhoto = false" />
    <PinBoard v-if="store.showBoard && store.role === 'admin'" />
    <div v-if="store.connecting" class="connecting">正在连接图书馆…</div>
  </template>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { store } from './store';
import { api } from './api';
import { net } from './net';
import { World } from './world/World';
import { worldHolder } from './world';
import StartScreen from './ui/StartScreen.vue';
import Hud from './ui/Hud.vue';
import PinPanel from './ui/PinPanel.vue';
import PinPhotoPanel from './ui/PinPhotoPanel.vue';
import PinBoard from './ui/PinBoard.vue';

const mount = ref(null);
let world = null;

async function authenticate({ mode, username, password, done }) {
  store.connecting = true;
  store.error = '';
  try {
    let result;
    if (mode === 'register') result = await api.register(username);
    else if (mode === 'login') result = await api.login(username);
    else result = await api.loginAdmin(username, password);
    await enterGallery(result.user);
  } catch (error) {
    done(error.message || '登录失败');
  } finally {
    store.connecting = false;
  }
}

async function enterGallery(user) {
  store.user = user;
  store.role = user.role;
  store.name = user.username;
  store.screen = 'world';
  await nextTick();
  try {
    await net.connect();
    store.floorMap = await api.floors();
    if (!world) {
      world = new World(mount.value);
      worldHolder.world = world;
      window.__world = world;
      window.__store = store;
    }
    world.setGhost(store.role === 'admin'
      ? store.ghost || store.settings.sharedGhost
      : store.settings.sharedGhost);
  } catch (error) {
    store.error = error.message || '无法连接服务器';
    store.screen = 'start';
  }
}

watch(() => [store.role, store.ghost, store.settings.sharedGhost], () => {
  if (!world) return;
  const enabled = store.role === 'admin'
    ? store.ghost || store.settings.sharedGhost
    : store.settings.sharedGhost;
  world.setGhost(enabled);
});

onMounted(async () => {
  try {
    const { user } = await api.me();
    await enterGallery(user);
  } catch {}
});

onBeforeUnmount(() => { net.disconnect(); });
</script>

<style scoped>
.scene-mount { position: absolute; inset: 0; }
.connecting { position: absolute; inset: 0; z-index: 80; display: grid; place-items: center; background: #0007; color: white; font-size: 20px; }
</style>
