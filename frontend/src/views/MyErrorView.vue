<template>
  <div class="container">
    <h1 class="section-title">📚 我的错题</h1>

    <div class="filter-bar card">
      <div class="field" style="min-width: 170px">
        <label>年级筛选</label>
        <select class="input" v-model="grade" @change="onFilter">
          <option value="all">全部年级</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div class="field" style="min-width: 170px">
        <label>学科筛选</label>
        <select class="input" v-model="subject" @change="onFilter">
          <option value="all">全部学科</option>
          <option v-for="s in SUBJECTS" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div class="field" style="min-width: 170px">
        <label>公开状态</label>
        <select class="input" v-model="scope" @change="onFilter">
          <option value="all">全部</option>
          <option value="public">仅公开</option>
          <option value="private">仅私有</option>
        </select>
      </div>
      <router-link to="/" class="btn">🔍 错题广场</router-link>
      <router-link to="/add" class="btn btn-success">+ 新增错题</router-link>
    </div>

    <div v-if="!list.length" class="empty-state">
      <img src="/img/empty.svg" alt="空" />
      <div class="empty-text">您还没有错题，快去添加吧！</div>
    </div>
    <template v-else>
      <ErrorCard
        v-for="e in list"
        :key="e.errorId"
        :error="e"
        variant="my"
        @edit="onEdit"
        @delete="onDelete"
      />
      <Pagination :page="page" :totalPages="totalPages" @change="onPage" />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ErrorCard from '@/components/ErrorCard.vue';
import Pagination from '@/components/Pagination.vue';
import { api } from '@/api';
import { GRADES, TYPES, SUBJECTS } from '@/utils/format';
import { toastSuccess, toastError, confirm, openModal } from '@/store/ui';

const list = ref([]);
const page = ref(1);
const totalPages = ref(1);
const grade = ref('all');
const subject = ref('all');
const scope = ref('all');

async function load() {
  const r = await api.getMyErrors({
    grade: grade.value,
    subject: subject.value,
    scope: scope.value,
    page: page.value,
  });
  if (r.code !== 200) {
    toastError(r.msg || '加载失败');
    return;
  }
  list.value = r.data.list || [];
  page.value = r.data.page;
  totalPages.value = r.data.totalPages;
}

function onFilter() {
  page.value = 1;
  load();
}
function onPage(p) {
  page.value = p;
  load();
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

function onEdit(e) {
  openModal({
    title: '编辑错题',
    bodyHtml: `
      <div class="field"><label>题目</label><textarea id="e-title">${esc(e.title)}</textarea></div>
      <div class="field"><label>标准答案</label><textarea id="e-answer">${esc(e.answer)}</textarea></div>
      <div class="field"><label>解析</label><textarea id="e-analysis">${esc(e.analysis)}</textarea></div>
      <div class="field"><label>错误类型</label><select class="input" id="e-type">${typeOptions(e.type)}</select></div>
      <div class="field"><label>所属年级</label><select class="input" id="e-grade">${gradeOptions(e.grade)}</select></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="e-public" ${e.isPublic ? 'checked' : ''} style="width:auto;"/> 公开</label></div>`,
    confirmText: '保存',
    onConfirm: async () => {
      const r = await api.updateError({
        errorId: e.errorId,
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

async function onDelete(e) {
  const ok = await confirm('确定删除该错题吗？相关点赞/收藏也会一并清除。');
  if (!ok) return;
  const r = await api.deleteError({ errorId: e.errorId });
  if (r.code === 200) {
    toastSuccess('已删除');
    load();
  } else toastError(r.msg || '删除失败');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

onMounted(load);
</script>
