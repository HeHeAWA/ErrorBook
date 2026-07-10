<template>
  <div class="container">
    <h1 class="section-title">🏆 错题点赞排行榜</h1>

    <div class="filter-bar card">
      <div class="field" style="min-width: 180px">
        <label>选择年级榜单（清空看全年级总榜）</label>
        <select class="input" v-model="grade" @change="onFilter">
          <option value="all">全部年级</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div class="field" style="min-width: 180px">
        <label>选择学科榜单</label>
        <select class="input" v-model="subject" @change="onFilter">
          <option value="all">全部学科</option>
          <option v-for="s in SUBJECTS" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <div v-if="!list.length" class="empty-state">
      <img src="/img/empty.svg" alt="空" />
      <div class="empty-text">该榜单暂无错题或暂无点赞数据～</div>
    </div>
    <template v-else>
      <ErrorCard v-for="e in list" :key="e.errorId" :error="e" variant="rank" />
      <Pagination :page="page" :totalPages="totalPages" @change="onPage" />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ErrorCard from '@/components/ErrorCard.vue';
import Pagination from '@/components/Pagination.vue';
import { api } from '@/api';
import { GRADES, SUBJECTS } from '@/utils/format';
import { toastError } from '@/store/ui';

const list = ref([]);
const page = ref(1);
const totalPages = ref(1);
const grade = ref('all');
const subject = ref('all');

async function load() {
  const r = await api.getRank({ grade: grade.value, subject: subject.value, page: page.value });
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

onMounted(load);
</script>
