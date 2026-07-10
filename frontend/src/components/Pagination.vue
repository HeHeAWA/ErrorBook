<template>
  <div class="pagination" v-if="totalPages > 1">
    <button class="page-btn" :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
    <template v-for="(p, i) in pages" :key="i">
      <span v-if="p === '...'" class="page-ellipsis">...</span>
      <button v-else class="page-btn" :class="{ active: p === page }" @click="$emit('change', p)">{{ p }}</button>
    </template>
    <button class="page-btn" :disabled="page >= totalPages" @click="$emit('change', page + 1)">下一页</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});

// 计算要显示的页码（最多 7 个：含首尾与当前附近）
const pages = computed(() => {
  const total = props.totalPages;
  const cur = props.page;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [];
  const start = Math.max(1, cur - 3);
  const end = Math.min(total, cur + 3);
  if (start > 1) {
    out.push(1);
    if (start > 2) out.push('...');
  }
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total) {
    if (end < total - 1) out.push('...');
    out.push(total);
  }
  return out;
});
</script>

<style scoped>
.page-ellipsis {
  color: #5a7ca8;
  padding: 0 4px;
}
</style>
