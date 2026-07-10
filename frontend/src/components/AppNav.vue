<template>
  <nav class="nav">
    <router-link to="/" class="brand"><span class="logo">📘</span> 个人错题集</router-link>
    <div class="nav-links">
      <router-link to="/" class="nav-link" :class="{ active: route.name === 'plaza' }">错题广场</router-link>
      <router-link to="/rank" class="nav-link" :class="{ active: route.name === 'rank' }">错题排行榜</router-link>
      <template v-if="auth.user">
        <router-link to="/settings" class="nav-link" :class="{ active: route.name === 'settings' }">个人设置</router-link>
        <router-link to="/my" class="nav-link" :class="{ active: route.name === 'my' }">我的错题</router-link>
        <router-link to="/add" class="nav-link" :class="{ active: route.name === 'add' }">新增错题</router-link>
        <router-link to="/report" class="nav-link" :class="{ active: route.name === 'report' }">错题分析</router-link>
        <router-link to="/review" class="nav-link" :class="{ active: route.name === 'review' }">今日复习</router-link>
        <router-link to="/aifind" class="nav-link" :class="{ active: route.name === 'aifind' }">识别错题</router-link>
        <span class="nav-user">👤 {{ auth.user.nickname }}</span>
        <button class="nav-link" @click="logout">退出登录</button>
      </template>
      <template v-else>
        <router-link to="/login" class="nav-link" :class="{ active: route.name === 'login' }">登录</router-link>
        <router-link to="/register" class="nav-link" :class="{ active: route.name === 'register' }">注册</router-link>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { auth, clearUser } from '@/store/auth';
import { api } from '@/api';
import { toastSuccess } from '@/store/ui';

const route = useRoute();
const router = useRouter();

async function logout() {
  await api.logout();
  clearUser();
  toastSuccess('已退出登录');
  router.push('/login');
}
</script>
