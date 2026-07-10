<template>
  <AppNav />
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>

  <!-- 顶部轻提示 -->
  <div class="toast-wrap">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type">{{ t.msg }}</div>
  </div>

  <!-- 通用弹窗（确认 / 表单） -->
  <div v-if="ui.modal" class="modal-mask show" @click.self="onCancelClick">
    <div class="modal-box">
      <div class="modal-head">{{ ui.modal.title }}</div>
      <div class="modal-body" id="mBody" v-html="ui.modal.bodyHtml || ''"></div>
      <div class="modal-foot">
        <button
          v-if="ui.modal.cancelText !== false"
          class="btn btn-ghost btn-sm"
          @click="onCancelClick"
        >
          {{ ui.modal.cancelText || '取消' }}
        </button>
        <button
          class="btn btn-sm"
          :class="ui.modal.danger ? 'btn-danger' : ''"
          @click="onConfirmClick"
        >
          {{ ui.modal.confirmText || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, nextTick } from 'vue';
import AppNav from '@/components/AppNav.vue';
import { ui, closeModal } from '@/store/ui';

// 弹窗打开后自动聚焦首个输入控件
watch(
  () => ui.modal,
  async (m) => {
    if (!m) return;
    await nextTick();
    const el = document.querySelector('#mBody input, #mBody textarea, #mBody select');
    if (el) el.focus();
  }
);

function onConfirmClick() {
  const fn = ui.modal && ui.modal.onConfirm;
  const keep = fn ? fn() : undefined;
  if (keep !== false) closeModal();
}
function onCancelClick() {
  const fn = ui.modal && ui.modal.onCancel;
  if (fn) fn();
  else closeModal();
}
</script>
