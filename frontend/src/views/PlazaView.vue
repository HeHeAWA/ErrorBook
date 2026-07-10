<template>
  <div class="container">
    <h1 class="section-title">🌟 公共错题广场</h1>

    <div class="filter-bar card">
      <div class="field" style="flex: 1; min-width: 200px">
        <label>搜索（题目 / 类型 / 年级）</label>
        <input class="input" v-model="keyword" @keyup.enter="onSearch" placeholder="输入关键词，回车或点击搜索" />
      </div>
      <div class="field" style="min-width: 150px">
        <label>年级筛选</label>
        <select class="input" v-model="grade" @change="onFilter">
          <option value="all">全部年级</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div class="field" style="min-width: 150px">
        <label>错误类型</label>
        <select class="input" v-model="type" @change="onFilter">
          <option value="all">全部类型</option>
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="field" style="min-width: 150px">
        <label>学科类别</label>
        <select class="input" v-model="subject" @change="onFilter">
          <option value="all">全部学科</option>
          <option v-for="s in SUBJECTS" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <button class="btn" @click="onSearch">搜索</button>
    </div>

    <div v-if="loading" class="empty-state"><div class="empty-text">加载中…</div></div>
    <div v-else-if="!list.length" class="empty-state">
      <img src="/img/empty.svg" alt="空" />
      <div class="empty-text">暂无符合条件的公共错题～快来添加第一题吧！</div>
    </div>
    <template v-else>
      <ErrorCard
        v-for="e in list"
        :key="e.errorId"
        :error="e"
        variant="plaza"
        @like="onLike"
        @collect="onCollect"
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
import { auth } from '@/store/auth';
import { toastWarning, toastSuccess, toastError } from '@/store/ui';

const list = ref([]);
const page = ref(1);
const totalPages = ref(1);
const grade = ref('all');
const type = ref('all');
const subject = ref('all');
const keyword = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  const r = await api.getErrorList({
    grade: grade.value,
    type: type.value,
    subject: subject.value,
    keyword: keyword.value,
    page: page.value,
  });
  loading.value = false;
  if (r.code !== 200) {
    toastError(r.msg || '加载失败');
    return;
  }
  list.value = r.data.list || [];
  page.value = r.data.page;
  totalPages.value = r.data.totalPages;
}

function onSearch() {
  page.value = 1;
  load();
}
function onFilter() {
  page.value = 1;
  load();
}
function onPage(p) {
  page.value = p;
  load();
}

async function onLike(e) {
  if (!auth.user) {
    toastWarning('请先登录后再操作');
    return;
  }
  const r = await api.toggleLike(e.errorId);
  if (r.code === 200) {
    e.liked = r.data.liked;
    e.likeCount = r.data.likeCount;
    toastSuccess(r.msg);
  } else toastError(r.msg || '操作失败');
}
async function onCollect(e) {
  if (!auth.user) {
    toastWarning('请先登录后再操作');
    return;
  }
  const r = await api.toggleCollect(e.errorId);
  if (r.code === 200) {
    e.collected = r.data.collected;
    e.collectCount = r.data.collectCount;
    toastSuccess(r.msg);
  } else toastError(r.msg || '操作失败');
}

onMounted(load);
</script>
