<template>
  <div class="panel vis-panel">
    <button class="close" @click="$emit('close')">✕</button>
    <h3>👀 看谁的物件</h3>
    <div class="row">
      <button @click="all">全选</button>
      <button @click="none">全不选</button>
      <span class="tip">取消勾选 = 隐藏他放的物件</span>
    </div>
    <label v-for="p in store.players" :key="p.id" class="vis-item">
      <input type="checkbox" :checked="checked(p.id)" @change="toggle(p.id)" />
      <span class="dot" :style="{ background: p.color }"></span>{{ p.name }}
    </label>
    <p v-if="!store.players.length" class="tip">房间里暂时没有其他人</p>
  </div>
</template>

<script setup>
import { store } from '../store';

function checked(id) {
  return !store.hiddenOwners.includes(id);
}
function toggle(id) {
  const i = store.hiddenOwners.indexOf(id);
  if (i >= 0) store.hiddenOwners.splice(i, 1);
  else store.hiddenOwners.push(id);
}
function all() { store.hiddenOwners = []; }
function none() {
  store.hiddenOwners = store.players.map((p) => p.id);
}
</script>

<style scoped>
.vis-panel { top: 70px; right: 16px; width: 240px; }
.vis-item { display: flex; align-items: center; gap: 8px; padding: 7px 4px; cursor: pointer; font-size: 14px; }
.dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
</style>
