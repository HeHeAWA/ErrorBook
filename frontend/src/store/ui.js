import { reactive } from 'vue';

// 全局 UI 状态：toast 列表 + 弹窗
export const ui = reactive({ toasts: [], modal: null });

let tid = 0;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 顶部轻提示 */
export function toast(msg, type = 'success', duration = 2600) {
  const id = ++tid;
  ui.toasts.push({ id, msg, type });
  setTimeout(() => {
    const i = ui.toasts.findIndex((t) => t.id === id);
    if (i > -1) ui.toasts.splice(i, 1);
  }, duration);
}

export const toastSuccess = (m) => toast(m, 'success');
export const toastError = (m) => toast(m, 'error');
export const toastWarning = (m) => toast(m, 'warning');

/** 确认弹窗：返回 Promise<boolean> */
export function confirm(msg, opts = {}) {
  return new Promise((resolve) => {
    ui.modal = {
      title: opts.title || '操作确认',
      bodyHtml: `<p style="margin:0">${escapeHtml(msg)}</p>`,
      confirmText: opts.confirmText || '确定',
      cancelText: opts.cancelText === false ? false : opts.cancelText || '取消',
      danger: !!opts.danger,
      onConfirm: () => {
        ui.modal = null;
        resolve(true);
      },
      onCancel: () => {
        ui.modal = null;
        resolve(false);
      },
    };
  });
}

/** 通用弹窗（bodyHtml 可含表单，onConfirm 内自行读取 DOM） */
export function openModal(opts) {
  ui.modal = { onCancel: closeModal, onConfirm: closeModal, ...opts };
}

export function closeModal() {
  ui.modal = null;
}
