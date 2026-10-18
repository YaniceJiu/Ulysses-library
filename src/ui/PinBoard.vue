<template>
  <div class="board-shade">
    <section class="board">
      <header>
        <div>
          <h2>📍 图书馆图钉 Board</h2>
          <p>实时位置、玩家与照片 · 管理员 {{ store.name }}</p>
        </div>
        <button @click="close">回到展厅</button>
      </header>

      <div class="board-settings">
        <label><input type="checkbox" :checked="store.settings.sharePins" @change="setSetting('sharePins', $event.target.checked)">
          让玩家看见其他玩家的图钉和照片</label>
        <label><input type="checkbox" :checked="store.settings.sharedGhost" @change="setSetting('sharedGhost', $event.target.checked)">
          向所有玩家开启幽灵模式</label>
        <span>玩家默认只能看见自己的图钉；管理员始终可查看全部。</span>
      </div>

      <div class="filters">
        <label>楼层
          <select v-model.number="floor">
            <option v-for="level in store.floorMap.floors" :key="level" :value="level">第 {{ level + 1 }} 层</option>
          </select>
        </label>
        <label>玩家
          <select v-model="ownerFilter">
            <option value="">所有玩家</option>
            <option v-for="name in owners" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <span>{{ filteredPins.length }} 枚图钉 · {{ owners.length }} 位玩家</span>
      </div>

      <div class="board-content">
        <div class="map-panel">
          <h3>楼层平面图 · 第 {{ floor + 1 }} 层</h3>
          <div class="map">
            <img :src="'/floorplans/' + floor + '.png'" alt="图书馆楼层平面图">
            <button v-for="pin in floorPins" :key="pin.id" class="map-pin"
              :style="mapPosition(pin)" :title="pin.ownerName"
              @click="selectedPin = pin">📍</button>
          </div>
          <p class="tip">底图为当前 Minecraft 建筑的楼层俯视图；标记位置对应展厅内图钉坐标。</p>
        </div>

        <div class="list-panel">
          <h3>图钉和照片</h3>
          <p v-if="!filteredPins.length" class="empty">此楼层/筛选条件下没有图钉。</p>
          <article v-for="pin in filteredPins" :key="pin.id" class="pin-card">
            <button class="photo-button" @click="selectedPin = pin">
              <img v-if="pin.photo" :src="pin.photoUrl" :alt="pin.ownerName + ' 的图钉照片'">
              <span v-else>暂无照片</span>
            </button>
            <div class="pin-info">
              <b>{{ pin.ownerName }}</b>
              <small>第 {{ Math.round(pin.y) + 1 }} 层 · X {{ pin.x.toFixed(1) }} / Z {{ pin.z.toFixed(1) }}</small>
              <small>{{ new Date(pin.updatedAt).toLocaleString() }}</small>
            </div>
            <button class="danger" @click="remove(pin)">删除</button>
          </article>
        </div>
      </div>

      <div v-if="selectedPin" class="photo-modal" @click.self="selectedPin = null">
        <button class="close" @click="selectedPin = null">关闭</button>
        <img v-if="selectedPin.photo" :src="selectedPin.photoUrl" alt="图钉照片大图">
        <p v-else>这枚图钉还没有照片。</p>
        <p>{{ selectedPin.ownerName }} · {{ selectedPin.x.toFixed(1) }}, {{ selectedPin.y.toFixed(1) }}, {{ selectedPin.z.toFixed(1) }}</p>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { store } from '../store';
import { api } from '../api';

const emit = defineEmits(['close']);
const floor = ref(0);
const ownerFilter = ref('');
const selectedPin = ref(null);
const error = ref('');
const pins = computed(() => store.pins.filter((pin) => !ownerFilter.value || pin.ownerName === ownerFilter.value));
const owners = computed(() => [...new Set(store.pins.map((pin) => pin.ownerName))].sort((a, b) => a.localeCompare(b)));
const floorPins = computed(() => pins.value.filter((pin) => Math.abs(pin.y - floor.value) < 0.7));
const filteredPins = computed(() => floorPins.value);

onMounted(async () => {
  try {
    const [allPins, floorMap] = await Promise.all([api.adminPins(), api.floors()]);
    store.pins = allPins;
    store.floorMap = floorMap;
    if (floorMap.floors.length) floor.value = floorMap.floors[0];
  } catch (err) { error.value = err.message; }
});

function mapPosition(pin) {
  const map = store.floorMap;
  return {
    left: ((pin.x + map.centerX) / map.width * 100) + '%',
    top: ((pin.z + map.centerZ) / map.depth * 100) + '%',
  };
}

async function setSetting(key, value) {
  error.value = '';
  try {
    store.settings = await api.updateSettings({ [key]: value });
  } catch (err) { error.value = err.message; }
}

async function remove(pin) {
  if (!confirm('删除 ' + pin.ownerName + ' 的这枚图钉及照片？')) return;
  error.value = '';
  try {
    await api.deletePin(pin.id);
    store.pins = store.pins.filter((item) => item.id !== pin.id);
    if (selectedPin.value && selectedPin.value.id === pin.id) selectedPin.value = null;
  } catch (err) { error.value = err.message; }
}

function close() {
  store.showBoard = false;
  emit('close');
}
</script>

<style scoped>
.board-shade { position: absolute; inset: 0; z-index: 55; display: grid; place-items: center; padding: 12px; background: #05090ddd; pointer-events: auto; }
.board { position: relative; width: min(1200px,98vw); height: min(92vh,900px); overflow: auto; padding: 18px; border-radius: 14px; color: #e8f0eb; background: #111a20; }
header,.filters,.board-settings,.pin-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
header { margin-bottom: 14px; }
header p,.tip,.board-settings span,.pin-info small,.empty { color: #aab8b1; font-size: 12px; }
.board-settings { justify-content: flex-start; flex-wrap: wrap; padding: 10px; border-radius: 8px; background: #1c2b2d; font-size: 13px; }
.board-settings label { display: flex; align-items: center; gap: 6px; }
.filters { justify-content: flex-start; margin: 14px 0; }
.filters label { display: flex; align-items: center; gap: 7px; font-size: 13px; }
.filters select { padding: 7px; }
.filters span { margin-left: auto; color: #b7c7c0; font-size: 12px; }
.board-content { display: grid; grid-template-columns: minmax(300px,1fr) minmax(330px,1fr); gap: 18px; }
.map-panel,.list-panel { min-width: 0; padding: 12px; border-radius: 10px; background: #1a242b; }
.map-panel h3,.list-panel h3 { margin-bottom: 10px; font-size: 15px; }
.map { position: relative; width: min(100%,540px); aspect-ratio: 100/98; margin: auto; overflow: hidden; background: #e9e9e9; }
.map img { width: 100%; height: 100%; object-fit: fill; image-rendering: pixelated; }
.map-pin { position: absolute; transform: translate(-50%,-50%); padding: 1px 3px; border-radius: 50%; background: #a32332e8; font-size: 14px; line-height: 1; }
.tip { margin-top: 8px; }
.list-panel { max-height: 68vh; overflow: auto; }
.pin-card { justify-content: flex-start; padding: 8px 0; border-bottom: 1px solid #ffffff18; }
.photo-button { width: 76px; height: 70px; flex: 0 0 76px; display: grid; place-items: center; padding: 0; overflow: hidden; color: #9aa8a3; background: #0b1217; font-size: 11px; }
.photo-button img { width: 100%; height: 100%; object-fit: cover; }
.pin-info { display: grid; flex: 1; gap: 4px; min-width: 0; }
.pin-info small { overflow-wrap: anywhere; }
.pin-card .danger { padding: 6px 8px; font-size: 12px; }
.photo-modal { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #000e; }
.photo-modal img { max-width: 90vw; max-height: 75vh; object-fit: contain; }
.photo-modal p { color: white; }
.close { position: absolute; top: 16px; right: 16px; }
.error { color: #ff9e92; padding: 8px; }
@media(max-width:760px) { .board { padding: 12px; } .board-content { grid-template-columns: 1fr; } .list-panel { max-height: none; } header h2 { font-size: 18px; } .filters { flex-wrap: wrap; } .filters span { width: 100%; } }
</style>
