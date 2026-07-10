<template>
  <div class="container" style="max-width: 460px">
    <div class="card" style="margin-top: 30px">
      <h1 class="section-title" style="margin-top: 0">🔑 登录</h1>
      <div class="field">
        <label>用户名</label>
        <input class="input" v-model="username" @input="tipU = ''" placeholder="请输入用户名" />
        <div class="error-tip">{{ tipU }}</div>
      </div>
      <div class="field">
        <label>密码</label>
        <input class="input" type="password" v-model="password" @input="tipP = ''" @keyup.enter="login" placeholder="请输入密码" />
        <div class="error-tip">{{ tipP }}</div>
      </div>
      <button class="btn" style="width: 100%" :disabled="loading" @click="login">登录</button>
      <p style="text-align: center; margin-top: 14px; color: #5a7ca8">
        还没有账号？<router-link to="/register">去注册</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { setUser } from '@/store/auth';
import { toastSuccess, toastError } from '@/store/ui';

const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const tipU = ref('');
const tipP = ref('');
const loading = ref(false);

async function login() {
  const u = username.value.trim();
  const p = password.value;
  if (!u) {
    tipU.value = '用户名不能为空';
    return;
  }
  if (!p) {
    tipP.value = '密码不能为空';
    return;
  }
  loading.value = true;
  const r = await api.login({ username: u, password: p });
  loading.value = false;
  if (r.code === 200) {
    toastSuccess('登录成功');
    setUser(r.data.user);
    const redirect = route.query.redirect;
    router.push(typeof redirect === 'string' && redirect ? redirect : '/');
  } else if (r.code === 403) {
    const remain = (r.data && r.data.remainMin) || '?';
    toastError(`账号已锁定，请于 ${remain} 分钟后重试`);
  } else {
    toastError(r.msg || '登录失败');
  }
}
</script>
