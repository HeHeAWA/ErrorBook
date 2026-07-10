<template>
  <div class="container" style="max-width: 1000px">
    <h2 class="section-title">📊 我的错题分析报告</h2>

    <div v-if="!loaded" class="empty-state"><div class="empty-text">加载中…</div></div>

    <div v-else>
      <div v-if="!data.total" class="empty-state">
        <img src="/img/empty.svg" alt="空" />
        <div class="empty-text">{{ data.suggestions.summary }}</div>
        <router-link to="/add" class="btn" style="margin-top: 14px">去新增错题</router-link>
      </div>

      <template v-else>
        <div class="card report-overview">
          <div class="ov-item"><div class="ov-num">{{ data.total }}</div><div class="ov-label">错题总数</div></div>
          <div class="ov-item"><div class="ov-num">{{ data.byType.length }}</div><div class="ov-label">涉及错误类型</div></div>
          <div class="ov-item"><div class="ov-num">{{ data.byGrade.length }}</div><div class="ov-label">涉及年级</div></div>
          <div class="ov-item"><div class="ov-num">{{ data.bySubject.length }}</div><div class="ov-label">涉及学科</div></div>
        </div>

        <div class="summary-bar">{{ data.suggestions.summary }}</div>

        <div class="report-grid">
          <div class="card">
            <div class="label" style="font-weight: 700; margin-bottom: 10px">错题类型分布</div>
            <div class="chart-row">
              <canvas id="pieCanvas" width="300" height="300"></canvas>
              <ul class="legend" id="pieLegend"></ul>
            </div>
          </div>
          <div class="card">
            <div class="label" style="font-weight: 700; margin-bottom: 10px">各年级错题数量</div>
            <canvas id="barCanvas"></canvas>
          </div>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="label" style="font-weight: 700; margin-bottom: 10px">各学科错题数量</div>
          <canvas id="subjectBarCanvas"></canvas>
        </div>

        <div class="card" style="margin-top: 16px">
          <div class="label" style="font-weight: 700; margin-bottom: 10px">📌 复习建议</div>
          <ul class="tip-list">
            <li class="tip-item" v-for="(s, i) in data.suggestions.list" :key="i">
              <span class="tip-dot" :style="{ background: COLORS[i % COLORS.length] }"></span>
              <div>
                <div class="tip-head">
                  <b>{{ s.name }}</b>
                  <span class="tip-count">{{ s.count }} 道 · 占 {{ s.percent }}%</span>
                </div>
                <div class="tip-body">{{ s.tip }}</div>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { drawPie, renderLegend, drawBars, COLORS } from '@/utils/charts';
import { api } from '@/api';
import { toastError } from '@/store/ui';

const router = useRouter();
const data = ref({ total: 0, byType: [], byGrade: [], bySubject: [], suggestions: { summary: '', list: [] } });
const loaded = ref(false);

async function load() {
  const r = await api.getReport();
  if (r.code === 401) {
    router.push('/login');
    return;
  }
  if (r.code !== 200) {
    toastError(r.msg || '加载失败');
    return;
  }
  data.value = r.data;
  loaded.value = true;
  if (r.data.total) {
    await nextTick();
    try {
      drawPie(document.getElementById('pieCanvas'), r.data.byType);
    } catch (e) {}
    try {
      drawBars(document.getElementById('barCanvas'), r.data.byGrade);
    } catch (e) {}
    try {
      drawBars(document.getElementById('subjectBarCanvas'), r.data.bySubject);
    } catch (e) {}
    renderLegend(document.getElementById('pieLegend'), r.data.byType, r.data.total);
  }
}

onMounted(load);
</script>
