<template>
  <div class="container" style="max-width: 460px">
    <div class="card" style="margin-top: 30px">
      <h1 class="section-title" style="margin-top: 0">📝 注册账号</h1>
      <div class="field">
        <label>用户名（仅纯英文字母，4-16 位，注册后不可修改）</label>
        <input class="input" v-model="username" @input="v.username()" placeholder="例如：alice" />
        <div class="error-tip">{{ tipUsername }}</div>
      </div>
      <div class="field">
        <label>昵称（2-20 字符）</label>
        <input class="input" v-model="nickname" @input="v.nickname()" placeholder="展示名称" />
        <div class="error-tip">{{ tipNickname }}</div>
      </div>
      <div class="field">
        <label>密码（6-20 位）</label>
        <input class="input" type="password" v-model="password" @input="v.password()" placeholder="请输入密码" />
        <div class="error-tip">{{ tipPassword }}</div>
      </div>
      <div class="field">
        <label>确认密码</label>
        <input class="input" type="password" v-model="confirm" @input="v.confirm()" placeholder="再次输入密码" />
        <div class="error-tip">{{ tipConfirm }}</div>
      </div>
      <button class="btn" style="width: 100%" :disabled="submitDisabled" @click="submit">注册</button>
      <p style="text-align: center; margin-top: 14px; color: #5a7ca8">
        已有账号？<router-link to="/login">去登录</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { toastSuccess, toastError } from '@/store/ui';

const router = useRouter();

const username = ref('');
const nickname = ref('');
const password = ref('');
const confirm = ref('');

const tipUsername = ref('');
const tipNickname = ref('');
const tipPassword = ref('');
const tipConfirm = ref('');
const submitDisabled = ref(true);

function checkUsername(v) {
  if (!v) return '用户名不能为空';
  if (!/^[a-zA-Z]{4,16}$/.test(v)) return '须为 4-16 位纯英文字母';
  return '';
}
function checkNickname(v) {
  const t = (v || '').trim();
  if (!t) return '昵称不能为空';
  if (t.length < 2 || t.length > 20) return '昵称须为 2-20 字符';
  return '';
}
function checkPassword(v) {
  if (!v) return '密码不能为空';
  if (v.length < 6 || v.length > 20) return '密码须为 6-20 位';
  return '';
}
function checkConfirm(v) {
  if (!v) return '请再次输入密码';
  if (v !== password.value) return '两次密码不一致';
  return '';
}

const v = {
  username: () => (tipUsername.value = checkUsername(username.value)),
  nickname: () => (tipNickname.value = checkNickname(nickname.value)),
  password: () => (tipPassword.value = checkPassword(password.value)),
  confirm: () => (tipConfirm.value = checkConfirm(confirm.value)),
};

function refresh() {
  v.username();
  v.nickname();
  v.password();
  v.confirm();
  submitDisabled.value = !(
    !tipUsername.value &&
    !tipNickname.value &&
    !tipPassword.value &&
    !tipConfirm.value
  );
}

async function submit() {
  refresh();
  if (submitDisabled.value) return;
  const r = await api.register({
    username: username.value.trim(),
    nickname: nickname.value.trim(),
    password: password.value,
    confirmPassword: confirm.value,
  });
  if (r.code === 200) {
    toastSuccess('注册成功，请登录');
    setTimeout(() => router.push('/login'), 1000);
  } else {
    toastError(r.msg || '注册失败');
  }
}

onMounted(() => {
  // 实时校验绑定
  username.value = username.value;
  refresh();
});
</script>
