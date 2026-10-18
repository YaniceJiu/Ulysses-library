<template>
  <div class="board-shade">
    <section class="board">
      <header>
        <div>
          <h2>📍 图书馆图钉 Board</h2>
          <p>全部图钉位置与照片 · 管理员 {{ store.name }}</p>
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

      <section class="map-panel">
        <div class="section-heading">
          <h3>图书馆整体平面图</h3>
          <span>{{ pins.length }} 枚图钉 · {{ owners.length }} 位玩家</span>
        </div>
        <div class="map">
          <img :src="'/floorplans/0.png'" alt="图书馆整体平面图">
          <button v-for="(pin, index) in pins" :key="pin.id" class="map-pin"
            :style="mapPosition(pin)" :title="`${pin.ownerName} · 第 ${Math.round(pin.y) + 1} 层`"
            @click="selectedPin = pin">{{ index + 1 }}</button>
        </div>
        <p class="tip">地图显示建筑整体俯视位置；不同楼层的图钉投影到同一张图上。对应楼层和时间见下表。</p>
      </section>

      <section class="list-panel">
        <h3>玩家图钉记录</h3>
        <p v-if="!pins.length" class="empty">还没有玩家放置图钉。</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr><th>玩家</th><th>放置时间</th><th>楼层</th><th>照片</th><th>位置</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="(pin, index) in pins" :key="pin.id">
                <td><span class="record-number">{{ index + 1 }}</span>{{ pin.ownerName }}</td>
                <td>{{ formatTime(pin.createdAt) }}</td>
                <td>第 {{ Math.round(pin.y) + 1 }} 层</td>
                <td>
                  <button class="photo-button" @click="selectedPin = pin">
                    <img v-if="pin.photo" :src="pin.photoUrl" :alt="pin.ownerName + ' 上传的照片'">
                    <span v-else>暂无照片</span>
                  </button>
                </td>
                <td>X {{ pin.x.toFixed(1) }} · Z {{ pin.z.toFixed(1) }}</td>
                <td><button class="danger" @click="remove(pin)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="selectedPin" class="photo-modal" @click.self="selectedPin = null">
        <button class="close" @click="selectedPin = null">关闭</button>
        <img v-if="selectedPin.photo" :src="selectedPin.photoUrl" alt="图钉照片大图">
        <p v-else>这枚图钉还没有照片。</p>
        <p>{{ selectedPin.ownerName }} · {{ formatTime(selectedPin.createdAt) }} · 第 {{ Math.round(selectedPin.y) + 1 }} 层</p>
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
const selectedPin = ref(null);
const error = ref('');
const pins = computed(() => [...store.pins].sort((a, b) => b.createdAt - a.createdAt));
const owners = computed(() => new Set(store.pins.map((pin) => pin.ownerId)).size);

onMounted(async () => {
  try {
    const [allPins, floorMap] = await Promise.all([api.adminPins(), api.floors()]);
    store.pins = allPins;
    store.floorMap = floorMap;
  } catch (err) { error.value = err.message; }
});

function mapPosition(pin) {
  const map = store.floorMap;
  return {
    left: ((pin.x + map.centerX) / map.width * 100) + '%',
    top: ((pin.z + map.centerZ) / map.depth * 100) + '%',
  };
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN');
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
header,.section-heading,.board-settings { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
header { margin-bottom: 14px; }
header p,.tip,.board-settings span,.empty { color: #aab8b1; font-size: 12px; }
.board-settings { justify-content: flex-start; flex-wrap: wrap; padding: 10px; border-radius: 8px; background: #1c2b2d; font-size: 13px; }
.board-settings label { display: flex; align-items: center; gap: 6px; }
.map-panel,.list-panel { min-width: 0; margin-top: 14px; padding: 12px; border-radius: 10px; background: #1a242b; }
.section-heading { margin-bottom: 10px; }
.section-heading h3,.list-panel h3 { font-size: 15px; }
.section-heading span { color: #b7c7c0; font-size: 12px; }
.map { position: relative; width: min(100%,760px); aspect-ratio: 100/98; margin: auto; overflow: hidden; background: #e9e9e9; }
.map img { width: 100%; height: 100%; object-fit: fill; image-rendering: pixelated; }
.map-pin { position: absolute; transform: translate(-50%,-50%); width: 22px; height: 22px; padding: 0; border: 1px solid white; border-radius: 50%; background: #a32332e8; font-size: 11px; line-height: 20px; }
.tip { margin-top: 8px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
th,td { padding: 8px; border-bottom: 1px solid #ffffff18; white-space: nowrap; }
th { color: #aab8b1; font-weight: 600; }
.record-number { display: inline-grid; width: 21px; height: 21px; margin-right: 7px; place-items: center; border-radius: 50%; background: #a32332; font-size: 11px; }
.photo-button { width: 76px; height: 58px; display: grid; place-items: center; padding: 0; overflow: hidden; color: #9aa8a3; background: #0b1217; font-size: 11px; }
.photo-button img { width: 100%; height: 100%; object-fit: cover; }
.danger { padding: 6px 8px; font-size: 12px; }
.photo-modal { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #000e; }
.photo-modal img { max-width: 90vw; max-height: 75vh; object-fit: contain; }
.photo-modal p { color: white; }
.close { position: absolute; top: 16px; right: 16px; }
.error { color: #ff9e92; padding: 8px; }
@media(max-width:760px) { .board { padding: 12px; } header h2 { font-size: 18px; } .board-settings { align-items: flex-start; flex-direction: column; } .map { width: 100%; } table { min-width: 680px; } }
</style>
