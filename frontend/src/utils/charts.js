/**
 * utils/charts.js —— 原生 Canvas 图表（零第三方库）
 * 提供甜甜圈饼图、横向条形图与图例渲染。
 */

const COLORS = [
  '#007bff', '#4da3ff', '#8ec5ff', '#0056b3', '#66b2ff', '#a3d4ff',
  '#003d80', '#3399ff', '#bfe0ff', '#1a75ff', '#cce5ff', '#0066cc',
  '#99ccff', '#004a99',
];

/** 圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 甜甜圈饼图 */
export function drawPie(canvas, data) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const size = 300;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 8;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  let start = -Math.PI / 2;
  data.forEach((d, i) => {
    const ang = (d.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + ang);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    if (ang > 0.25) {
      const mid = start + ang / 2;
      const lx = cx + Math.cos(mid) * r * 0.62;
      const ly = cy + Math.sin(mid) * r * 0.62;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((d.count / total) * 100) + '%', lx, ly);
    }
    start += ang;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f9ff';
  ctx.fill();
  ctx.fillStyle = '#002b5c';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 8);
  ctx.fillStyle = '#5a7ca8';
  ctx.font = '12px sans-serif';
  ctx.fillText('错题总数', cx, cy + 14);
}

/** 饼图图例 */
export function renderLegend(ul, data, total) {
  if (!ul) return;
  ul.innerHTML = data
    .map(
      (d, i) => `
      <li class="legend-item">
        <span class="legend-color" style="background:${COLORS[i % COLORS.length]}"></span>
        <span class="legend-name">${escapeHtml(d.name)}</span>
        <span class="legend-val">${d.count} 道 · ${Math.round((d.count / total) * 100)}%</span>
      </li>`
    )
    .join('');
}

/** 横向条形图（按年级 / 学科） */
export function drawBars(canvas, data) {
  if (!canvas || !data.length) return;
  const dpr = window.devicePixelRatio || 1;
  const labelW = 92;
  const rightPad = 44;
  const rowH = 30;
  const W = 560;
  const H = Math.max(60, data.length * rowH + 16);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.maxWidth = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const max = Math.max.apply(null, data.map((d) => d.count)) || 1;
  const barMax = W - labelW - rightPad;

  data.forEach((d, i) => {
    const y = 8 + i * rowH;
    ctx.fillStyle = '#002b5c';
    ctx.font = '13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.name, labelW - 8, y + rowH / 2 - 1);
    const bw = Math.max(2, (d.count / max) * barMax);
    roundRect(ctx, labelW, y + 4, bw, rowH - 12, 6);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.fillStyle = '#5a7ca8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(d.count), labelW + bw + 6, y + rowH / 2 - 1);
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { COLORS };
