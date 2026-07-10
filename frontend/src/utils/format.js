/**
 * utils/format.js —— 公共工具：枚举、转义、时间格式化
 */

// 年级 / 类型 / 学科枚举（与后端保持一致）
export const GRADES = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三', '高一', '高二', '高三', '大学', '其他',
];
export const TYPES = ['计算失误', '概念混淆', '审题错误', '记忆遗漏', '其他'];
export const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'];

/** HTML 转义：防止 XSS（前后端双重防护） */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 时间戳格式化为本地字符串 */
export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 时间戳格式化为日期（YYYY/MM/DD） */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}
