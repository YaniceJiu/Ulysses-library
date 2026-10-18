<template>
  <main class="admin-shell">
    <PinBoard v-if="store.user && store.user.role === 'admin'" />
    <section v-else class="login">
      <h1>图钉 Board 管理员登录</h1>
      <p>管理员账号：JaniceJiu</p>
      <form @submit.prevent="login">
        <label for="password">管理员密码</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required>
        <button :disabled="busy">{{ busy ? '登录中…' : '登录并打开 Board' }}</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <a href="/">返回图书馆</a>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../src/api';
import { net } from '../src/net';
import { store } from '../src/store';
import PinBoard from '../src/ui/PinBoard.vue';

const password = ref('');
const busy = ref(false);
const error = ref('');

async function openBoard(user) {
  store.user = user;
  store.name = user.username;
  store.role = 'admin';
  await net.connect();
}

async function login() {
  busy.value = true;
  error.value = '';
  try {
    const { user } = await api.loginAdmin('JaniceJiu', password.value);
    await openBoard(user);
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

onMounted(async () => {
  try {
    const { user } = await api.me();
    if (user.role === 'admin') await openBoard(user);
  } catch {}
});
</script>

<style>
html,body,#admin { width:100%;height:100%;margin:0;background:#071014;color:#ecf2ee;font-family:system-ui,"Microsoft YaHei",sans-serif; }
.admin-shell { min-height:100%; }
.login { width:min(92vw,420px);margin:10vh auto;padding:26px;border-radius:14px;background:#111a20;box-shadow:0 12px 40px #0008; }
.login h1 { font-size:22px; }
.login p,.login a { color:#b6c5bd; }
.login form { display:grid;gap:10px;margin:18px 0; }
.login input { padding:12px;border:1px solid #52615c;border-radius:8px;background:#0b1219;color:#fff;font-size:16px; }
.login button { padding:11px;background:#16745d;color:white;border:0;border-radius:8px; }
.login .error { color:#ff9e92; }
</style>
