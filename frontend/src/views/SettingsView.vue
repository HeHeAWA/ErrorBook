<template>
  <div class="container" style="max-width: 680px">
    <h1 class="section-title">⚙️ 个人设置</h1>

    <div class="card" style="margin-top: 16px">
      <h3 style="margin-bottom: 10px; color: #002b5c">修改昵称</h3>
      <div class="field">
        <input class="input" v-model="nickname" @input="checkNick" placeholder="2-20 字符" />
        <div class="error-tip">{{ tipNick }}</div>
      </div>
      <button class="btn" @click="saveNick">保存昵称</button>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 10px; color: #002b5c">修改个人简介</h3>
      <div class="field">
        <textarea v-model="bio" maxlength="50" @input="onBioInput" placeholder="最多 50 字"></textarea>
        <div class="char-count"><span>{{ bioCount }}</span> 字剩余</div>
      </div>
      <button class="btn" @click="saveBio">保存简介</button>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 10px; color: #002b5c">修改头像</h3>
      <div class="field" style="display: flex; gap: 14px; align-items: center">
        <img class="avatar" :src="avatarPreview" @error="onAvatarError" alt="头像" />
        <div style="flex: 1">
          <input class="input" v-model="avatarUrl" @blur="onAvatarBlur" placeholder="输入图片 URL（须以 http/https 开头）" />
          <div class="error-tip">{{ tipAvatar }}</div>
        </div>
      </div>
      <button class="btn" @click="saveAvatar">保存头像</button>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 10px; color: #002b5c">修改密码</h3>
      <div class="field">
        <label>原密码</label>
        <input class="input" type="password" v-model="oldPwd" />
      </div>
      <div class="field">
        <label>新密码（6-20 位）</label>
        <input class="input" type="password" v-model="newPwd" />
      </div>
      <div class="field">
        <label>确认新密码</label>
        <input class="input" type="password" v-model="newPwd2" />
      </div>
      <button class="btn" @click="savePwd">更新密码</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { auth } from '@/store/auth';
import { toastSuccess, toastError } from '@/store/ui';

const DEFAULT_AVATAR = '/img/default-avatar.svg';

const nickname = ref('');
const bio = ref('');
const bioCount = ref(50);
const avatarUrl = ref('');
const avatarPreview = ref(DEFAULT_AVATAR);
const oldPwd = ref('');
const newPwd = ref('');
const newPwd2 = ref('');

const tipNick = ref('');
const tipAvatar = ref('');

function checkNick() {
  const t = nickname.value.trim();
  tipNick.value = !t ? '昵称不能为空' : t.length < 2 || t.length > 20 ? '昵称须为 2-20 字符' : '';
}

function onBioInput() {
  bioCount.value = Math.max(0, 50 - bio.value.length);
}

function onAvatarBlur() {
  const v = avatarUrl.value.trim();
  if (!v) {
    avatarPreview.value = DEFAULT_AVATAR;
    tipAvatar.value = '';
    return;
  }
  if (!/^https?:\/\//i.test(v)) {
    tipAvatar.value = '链接须以 http/https 开头';
    return;
  }
  tipAvatar.value = '';
  avatarPreview.value = v;
}
function onAvatarError() {
  avatarPreview.value = DEFAULT_AVATAR;
}

async function saveNick() {
  const t = nickname.value.trim();
  if (!t || t.length < 2 || t.length > 20) {
    tipNick.value = '昵称须为 2-20 字符';
    return;
  }
  const r = await api.updateUser({ nickname: t });
  if (r.code === 200) {
    toastSuccess('昵称已更新');
    if (auth.user) auth.user.nickname = t;
  } else toastError(r.msg || '更新失败');
}

async function saveBio() {
  if (bio.value.length > 50) {
    toastError('简介不能超过 50 字');
    return;
  }
  const r = await api.updateUser({ bio: bio.value.trim() });
  if (r.code === 200) toastSuccess('简介已更新');
  else toastError(r.msg || '更新失败');
}

async function saveAvatar() {
  const v = avatarUrl.value.trim();
  if (v && !/^https?:\/\//i.test(v)) {
    tipAvatar.value = '链接须以 http/https 开头';
    return;
  }
  const r = await api.updateUser({ avatarUrl: v });
  if (r.code === 200) toastSuccess('头像已更新');
  else toastError(r.msg || '更新失败');
}

async function savePwd() {
  const oldP = oldPwd.value;
  const np = newPwd.value;
  const np2 = newPwd2.value;
  if (!oldP) return toastError('请输入原密码');
  if (!np || np.length < 6 || np.length > 20) return toastError('新密码须为 6-20 位');
  if (np !== np2) return toastError('两次新密码不一致');
  const r = await api.updateUser({ oldPassword: oldP, newPassword: np, confirmPassword: np2 });
  if (r.code === 200) {
    toastSuccess('密码已更新');
    oldPwd.value = newPwd.value = newPwd2.value = '';
  } else toastError(r.msg || '更新失败');
}

onMounted(async () => {
  const r = await api.getUserInfo();
  if (r.code === 200) {
    const u = r.data.user;
    nickname.value = u.nickname || '';
    bio.value = u.bio || '';
    bioCount.value = Math.max(0, 50 - (u.bio || '').length);
    avatarUrl.value = u.avatarUrl || '';
    avatarPreview.value = u.avatarUrl || DEFAULT_AVATAR;
  }
});
</script>
