<template>
  <div class="container">
    <h1 class="section-title">🧠 今日复习</h1>
    <p class="review-intro">
      根据艾宾浩斯遗忘曲线，系统在你提交错题后的第 1 / 2 / 4 / 7 / 15 / 30 天自动安排复习。以下是今天需要巩固的题目。
    </p>

    <div class="review-summary card">
      <div v-if="loading" class="summary-text">加载中…</div>
      <div v-else-if="summary.dueCount === 0" class="summary-ok">
        🎉 今天没有需要复习的错题，保持得很好！去「新增错题」积累，或到「错题广场」逛逛吧。
      </div>
      <template v-else>
        <div class="summary-num">{{ summary.dueCount }}</div>
        <div class="summary-text">
          <div>道错题待复习（共 <b>{{ summary.totalDueStages }}</b> 个复习阶段）</div>
          <div class="summary-sub">完成复习后系统会自动安排下一次巩固时间。</div>
        </div>
      </template>
    </div>

    <div v-if="loading" class="empty-state"><div class="empty-text">加载中…</div></div>
    <div v-else-if="!list.length" class="empty-state">
      <img src="/img/empty.svg" alt="空" />
      <div class="empty-text">暂时没有待复习的错题，轻松一下～</div>
    </div>

    <template v-else>
      <div class="card review-item" v-for="e in list" :key="e.errorId">
        <div class="row">
          <span class="title">{{ e.title }}</span>
          <span class="tag">{{ e.grade }}</span>
          <span class="tag tag-subject">{{ e.subject }}</span>
          <span class="tag tag-type">{{ e.type }}</span>
        </div>
        <div class="review-progress">
          <div class="progress-bar"><div class="progress-fill" :style="{ width: pct(e) + '%' }"></div></div>
          <span class="progress-text">复习进度 {{ e.reviewedCount }}/{{ e.totalStages }}</span>
        </div>
        <div class="review-meta" v-html="metaLine(e)"></div>
        <div class="review-analysis">
          <div class="ra-label">解析（复习要点）</div>
          <div class="ra-text">{{ e.analysis || '（暂无解析）' }}</div>
        </div>
        <div class="review-next" v-html="nextReview(e)"></div>
        <div class="row actions">
          <button class="btn btn-success btn-sm" @click="markDone(e)">✅ 我已复习</button>
          <router-link class="btn btn-sm btn-ghost" :to="`/error/${e.errorId}`">查看详情</router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { formatDate } from '@/utils/format';
import { toastSuccess, toastError } from '@/store/ui';

const loading = ref(false);
const summary = ref({ dueCount: 0, totalDueStages: 0 });
const list = ref([]);

function stageLabel(i) {
  return '第 ' + (i + 1) + ' 次';
}
function pct(e) {
  return Math.round((e.reviewedCount / e.totalStages) * 100);
}
function metaLine(e) {
  if (e.overdueDays > 0)
    return `⚠️ 已逾期 <b>${e.overdueDays}</b> 天${e.dueCount > 1 ? `，共 ${e.dueCount} 个阶段待复习` : ''}`;
  return `📅 距离提交已 ${e.elapsedDays} 天，本次为${e.nextStage !== null ? stageLabel(e.nextStage) : '全部完成'}复习`;
}
function nextReview(e) {
  if (e.nextStage !== null && e.nextReviewDate)
    return `下一次复习：<b>${formatDate(e.nextReviewDate)}</b>`;
  return `✅ 全部复习阶段已完成`;
}

async function load() {
  loading.value = true;
  const r = await api.getReviewList();
  loading.value = false;
  if (r.code !== 200) {
    toastError(r.msg || '加载失败');
    return;
  }
  summary.value = r.data.summary || { dueCount: 0, totalDueStages: 0 };
  list.value = r.data.list || [];
}

async function markDone(e) {
  const r = await api.markReviewed(e.errorId);
  if (r.code === 200) {
    toastSuccess(r.msg || '已记录复习');
    load();
  } else toastError(r.msg || '操作失败');
}

onMounted(load);
</script>
