<template>
  <div class="card" :class="variant === 'rank' ? 'rank-item ' + topClass : 'error-item'">
    <!-- 排行榜变体 -->
    <template v-if="variant === 'rank'">
      <span class="rank-no">{{ error.rank }}</span>
      <img
        v-if="error.images && error.images.length"
        class="card-thumb"
        style="margin-right: 12px"
        :src="error.images[0]"
        alt="图"
      />
      <div style="flex: 1">
        <div class="title" style="font-weight: 700; color: #002b5c">{{ error.title }}</div>
        <div class="meta" style="font-size: 13px; color: #5a7ca8; margin-top: 4px">
          <span class="tag">{{ error.grade }}</span>
          <span class="tag tag-subject">{{ error.subject || '其他' }}</span>
          <span style="margin-left: 8px">作者：{{ error.authorNickname }}</span>
          <span style="margin-left: 8px">❤️ 点赞 {{ error.likeCount }}</span>
        </div>
      </div>
      <router-link class="btn btn-sm btn-ghost" :to="`/error/${error.errorId}`">查看详情</router-link>
    </template>

    <!-- 广场 / 我的错题 变体 -->
    <template v-else>
      <div class="row">
        <span class="title">{{ error.title }}</span>
        <span class="tag">{{ error.grade }}</span>
        <span class="tag tag-subject">{{ error.subject || '其他' }}</span>
        <span class="tag tag-type">{{ error.type }}</span>
        <span
          v-if="variant === 'my'"
          class="tag"
          :style="{
            background: error.isPublic
              ? 'linear-gradient(135deg,#28a745,#1e7e34)'
              : 'linear-gradient(135deg,#8ec5ff,#4da3ff)',
          }"
          >{{ error.isPublic ? '公开' : '私有' }}</span
        >
      </div>

      <div v-if="error.images && error.images.length" class="card-thumb-wrap">
        <img class="card-thumb" :src="error.images[0]" alt="图" />
        <span v-if="error.images.length > 1" class="card-thumb-badge">📷{{ error.images.length }}</span>
      </div>

      <div v-if="variant === 'plaza'" class="row meta">
        作者：{{ error.authorNickname }} ｜ ❤️ {{ error.likeCount }} ｜ ⭐ {{ error.collectCount }}
      </div>
      <div v-else-if="variant === 'my'" class="row meta">
        ❤️ {{ error.likeCount }} ｜ ⭐ {{ error.collectCount }} ｜ {{ formatTime(error.createTime) }}
      </div>

      <div class="row actions">
        <template v-if="variant === 'plaza'">
          <button class="btn btn-sm" :class="{ 'like-active': error.liked }" @click="$emit('like', error)">
            {{ error.liked ? '取消点赞' : '点赞' }}
          </button>
          <button
            class="btn btn-sm btn-ghost"
            :class="{ 'collect-active': error.collected }"
            @click="$emit('collect', error)"
          >
            {{ error.collected ? '取消收藏' : '收藏' }}
          </button>
        </template>
        <template v-else-if="variant === 'my'">
          <button class="btn btn-sm" @click="$emit('edit', error)">编辑</button>
          <button class="btn btn-sm btn-danger" @click="$emit('delete', error)">删除</button>
        </template>
        <router-link class="btn btn-sm btn-ghost" :to="`/error/${error.errorId}`">查看详情</router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatTime } from '@/utils/format';

const props = defineProps({
  error: { type: Object, required: true },
  variant: { type: String, default: 'plaza' }, // plaza | my | rank
});

defineEmits(['like', 'collect', 'edit', 'delete']);

const topClass = computed(() => {
  const r = props.error.rank;
  if (r === 1) return 'top1';
  if (r === 2) return 'top2';
  if (r === 3) return 'top3';
  return '';
});
</script>
