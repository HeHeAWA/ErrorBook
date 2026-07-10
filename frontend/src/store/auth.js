import { reactive } from 'vue';
import { api } from '@/api';

// 全局登录态（响应式）
export const auth = reactive({ user: null, loaded: false });

/** 拉取当前登录用户；未登录则 user 置空 */
export async function fetchUser() {
  try {
    const r = await api.getUserInfo();
    auth.user = r.code === 200 ? r.data.user : null;
  } catch (e) {
    auth.user = null;
  }
  auth.loaded = true;
  return auth.user;
}

export function setUser(u) {
  auth.user = u;
  auth.loaded = true;
}

export function clearUser() {
  auth.user = null;
  auth.loaded = true;
}
