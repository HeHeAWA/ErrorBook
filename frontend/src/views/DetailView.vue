<template>
  <div class="container" style="max-width: 760px">
    <div v-if="!error" class="empty-state" style="margin-top: 30px">
      <img src="/img/empty.svg" alt="空" />
      <div class="empty-text">{{ notFoundMsg }}</div>
      <router-link to="/" class="btn" style="margin-top: 14px">返回首页</router-link>
    </div>

    <div v-else class="card" style="margin-top: 24px">
      <div class="row" style="margin-bottom: 10px">
        <span class="title" style="font-size: 20px">{{ error.title }}</span>
        <span class="tag">{{ error.grade }}</span>
        <span class="tag tag-subject">{{ error.subject || '其他' }}</span>
        <span class="tag tag-type">{{ error.type }}</span>
      </div>

      <div class="detail-block">
        <div class="label" style="display: flex; align-items: center; gap: 10px">
          标准答案与解析
          <button class="btn btn-sm btn-ghost" @click="showAnswer = !showAnswer" style="margin-left: auto">
            {{ showAnswer ? '隐藏答案' : '显示答案' }}
          </button>
        </div>
        <div v-show="showAnswer">
          <div class="value"><span class="sub-label">标准答案：</span>{{ error.answer }}</div>
          <div class="value" style="margin-top: 12px"><span class="sub-label">解析：</span>{{ error.analysis }}</div>
        </div>
      </div>

      <div v-if="error.images && error.images.length" class="img-gallery">
        <div class="img-thumb" v-for="(src, i) in error.images" :key="i">
          <img :src="src" alt="错题图片" @click="openImg(src)" />
          <button v-if="error.isOwner" class="img-del" @click="removeImage(i)">×</button>
        </div>
      </div>

      <div v-if="error.isOwner" class="field" style="margin-top: 14px">
        <label>添加图片（还可上传 {{ remain }} 张，单张 ≤ 2MB）</label>
        <input
          type="file"
          class="input"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          :disabled="remain === 0"
          @change="addImages"
          ref="imgInput"
        />
        <div class="error-tip">{{ imgTip }}</div>
      </div>

      <div class="meta" style="color: #5a7ca8; font-size: 13px; margin-bottom: 12px">
        作者：{{ error.authorNickname }} ｜ 创建时间：{{ error.createTimeText }} ｜ ❤️
        {{ error.likeCount }} ｜ ⭐ {{ error.collectCount }} ｜ {{ error.isPublic ? '公开' : '私有' }}
      </div>

      <div class="row actions">
        <button class="btn btn-sm" :class="{ 'like-active': error.liked }" @click="toggle('like')">
          {{ error.liked ? '取消点赞' : '点赞' }}
        </button>
        <button class="btn btn-sm btn-ghost" :class="{ 'collect-active': error.collected }" @click="toggle('collect')">
          {{ error.collected ? '取消收藏' : '收藏' }}
        </button>
        <button v-if="error.isOwner" class="btn btn-sm" @click="openEdit">编辑</button>
        <button v-if="error.isOwner" class="btn btn-sm btn-danger" @click="doDelete">删除</button>
        <router-link to="/" class="btn btn-sm btn-ghost">返回列表</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { auth } from '@/store/auth';
import { escapeHtml } from '@/utils/format';
import { toastSuccess, toastError, toastWarning, confirm, openModal } from '@/store/ui';
import { GRADES, TYPES, SUBJECTS } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const errorId = route.params.id;

const error = ref(null);
const notFoundMsg = ref('错题不存在');
const showAnswer = ref(false);
const imgTip = ref('');
const imgInput = ref(null);

const remain = computed(() => Math.max(0, 5 - (error.value && error.value.images ? error.value.images.length : 0)));

async function load() {
  if (!errorId) {
    notFoundMsg.value = '缺少错题ID';
    return;
  }
  const r = await api.getErrorDetail(errorId);
  if (r.code === 403) {
    notFoundMsg.value = '无权查看该私有错题';
    setTimeout(() => router.push('/login'), 1200);
    return;
  }
  if (r.code !== 200) {
    notFoundMsg.value = r.msg || '错题不存在';
    return;
  }
  error.value = r.data.error;
}

function openImg(src) {
  window.open(src, '_blank');
}

async function removeImage(idx) {
  const ok = await confirm('确定删除这张图片吗？');
  if (!ok) return;
  const arr = (error.value.images || []).slice();
  arr.splice(idx, 1);
  const r = await api.updateError({ errorId, images: arr });
  if (r.code === 200) {
    toastSuccess('已删除图片');
    load();
  } else toastError(r.msg || '删除失败');
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
async function addImages(e) {
  const input = e.target;
  const files = Array.from(input.files || []);
  const cur = error.value.images ? error.value.images.length : 0;
  const r0 = Math.max(0, 5 - cur);
  const bad = files.find((f) => !ALLOWED.includes(f.type));
  if (bad) {
    imgTip.value = '仅支持 JPG/PNG/GIF/WEBP 图片';
    input.value = '';
    return;
  }
  const big = files.find((f) => f.size > 2 * 1024 * 1024);
  if (big) {
    imgTip.value = '单张图片不能超过 2MB';
    input.value = '';
    return;
  }
  if (files.length > r0) {
    imgTip.value = `最多还能上传 ${r0} 张`;
    input.value = '';
    return;
  }
  if (!files.length) return;
  imgTip.value = '';
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  fd.append('errorId', errorId);
  const r = await api.uploadErrorImages(fd);
  if (r.code !== 200) {
    toastError(r.msg || '上传失败');
    input.value = '';
    return;
  }
  const merged = (error.value.images || []).concat(r.data.images);
  const u = await api.updateError({ errorId, images: merged });
  if (u.code === 200) {
    toastSuccess('图片已添加');
    load();
  } else toastError(u.msg || '更新失败');
  input.value = '';
}

async function toggle(act) {
  if (!auth.user) {
    toastWarning('请先登录');
    return;
  }
  const r = act === 'like' ? await api.toggleLike(errorId) : await api.toggleCollect(errorId);
  if (r.code === 200) {
    toastSuccess(r.msg);
    if (act === 'like') {
      error.value.liked = r.data.liked;
      error.value.likeCount = r.data.likeCount;
    } else {
      error.value.collected = r.data.collected;
      error.value.collectCount = r.data.collectCount;
    }
  } else toastError(r.msg || '操作失败');
}

function openEdit() {
  const e = error.value;
  openModal({
    title: '编辑错题',
    bodyHtml: `
      <div class="field"><label>题目</label><textarea id="e-title">${escapeHtml(e.title)}</textarea></div>
      <div class="field"><label>标准答案</label><textarea id="e-answer">${escapeHtml(e.answer)}</textarea></div>
      <div class="field"><label>解析</label><textarea id="e-analysis">${escapeHtml(e.analysis)}</textarea></div>
      <div class="field"><label>错误类型</label><select class="input" id="e-type">${typeOptions(e.type)}</select></div>
      <div class="field"><label>所属年级</label><select class="input" id="e-grade">${gradeOptions(e.grade)}</select></div>
      <div class="field"><label>所属学科</label><select class="input" id="e-subject">${subjectOptions(e.subject)}</select></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="e-public" ${e.isPublic ? 'checked' : ''} style="width:auto;"/> 公开</label></div>`,
    confirmText: '保存',
    onConfirm: async () => {
      const r = await api.updateError({
        errorId,
        title: document.getElementById('e-title').value.trim(),
        answer: document.getElementById('e-answer').value.trim(),
        analysis: document.getElementById('e-analysis').value.trim(),
        type: document.getElementById('e-type').value,
        grade: document.getElementById('e-grade').value,
        subject: document.getElementById('e-subject').value,
        isPublic: document.getElementById('e-public').checked,
      });
      if (r.code === 200) {
        toastSuccess('已保存');
        load();
      } else toastError(r.msg || '保存失败');
    },
  });
}

function typeOptions(sel) {
  return TYPES.map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${t}</option>`).join('');
}
function gradeOptions(sel) {
  return GRADES.map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${t}</option>`).join('');
}
function subjectOptions(sel) {
  return SUBJECTS.map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${t}</option>`).join('');
}

async function doDelete() {
  const ok = await confirm('确定删除该错题吗？相关点赞/收藏也会一并清除。');
  if (!ok) return;
  const r = await api.deleteError({ errorId });
  if (r.code === 200) {
    toastSuccess('已删除');
    setTimeout(() => router.push('/my'), 900);
  } else toastError(r.msg || '删除失败');
}

onMounted(load);
</script>
