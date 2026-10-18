<template>
  <main class="auth-screen">
    <section class="auth-card">
      <h1>尤利西斯 · 图书馆漫游</h1>
      <p class="subtitle">走进 Minecraft 图书馆，在喜欢的位置留下图钉。</p>

      <div class="auth-tabs">
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册玩家</button>
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">玩家登录</button>
        <button :class="{ active: mode === 'admin' }" @click="mode = 'admin'">管理员</button>
      </div>

      <form @submit.prevent="submit">
        <label for="username">用户名</label>
        <input id="username" v-model.trim="username" maxlength="24" autocomplete="username"
          placeholder="2–24 个字母、数字或符号" required />
        <template v-if="mode === 'admin'">
          <label for="password">管理员密码</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </template>
        <p v-if="mode !== 'admin'" class="notice">用户名不区分大小写。玩家账号仅用用户名识别，别人可能冒用同名账号。</p>
        <p v-else class="notice">管理员用户名固定为 JaniceJiu。</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="submit" type="submit" :disabled="busy">
          {{ busy ? '请稍候…' : mode === 'register' ? '注册并进入' : mode === 'login' ? '登录并进入' : '管理员登录' }}
        </button>
      </form>
      <p class="controls">电脑：点击画面后用 WASD 移动、空格跳跃、Shift 奔跑、鼠标转向。<br>
        手机：使用屏幕方向键，拖动画面转向。</p>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../store';

const mode = ref('register');
const username = ref(store.name || '');
const password = ref('');
const error = ref('');
const busy = ref(false);
const emit = defineEmits(['submit']);

function submit() {
  error.value = '';
  busy.value = true;
  emit('submit', {
    mode: mode.value,
    username: username.value,
    password: password.value,
    done: (message) => { error.value = message || ''; busy.value = false; },
  });
}
</script>

<style scoped>
.auth-screen { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; background: linear-gradient(150deg,#172333,#334b44); color: #edf4e9; }
.auth-card { width: min(100%,440px); padding: 28px; border: 1px solid #ffffff26; border-radius: 18px; background: #101922ed; box-shadow: 0 18px 70px #0008; }
h1 { font-size: 24px; line-height: 1.3; }
.subtitle,.notice,.controls { color: #bdc9c2; line-height: 1.65; }
.subtitle { margin: 8px 0 20px; }
.auth-tabs { display: flex; gap: 7px; margin-bottom: 18px; }
.auth-tabs button { flex: 1; background: #334155; }
.auth-tabs button.active { background: #16745d; }
form { display: grid; gap: 9px; }
label { margin-top: 5px; font-size: 14px; }
input { width: 100%; padding: 12px; border: 1px solid #52615c; border-radius: 8px; background: #0b1219; color: white; font-size: 16px; }
.notice { font-size: 12px; }
.error { color: #ff9e92; }
.submit { width: 100%; padding: 12px; background: #16745d; font-weight: 700; }
.controls { margin-top: 18px; font-size: 12px; }
</style>
