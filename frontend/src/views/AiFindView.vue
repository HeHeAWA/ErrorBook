<template>
  <div class="container" style="padding-top: 24px">
    <div class="ai-disclaimer">
      ⚠️ <b>温馨提示</b>：本功能由<b>本地 OCR 文字识别</b>自动分析试卷，<b>结果可能有误，仅供参考</b>。请务必人工核对后再决定是否加入错题集。
    </div>

    <div class="card" style="margin-top: 16px">
      <h2 style="color: var(--primary-dark); font-size: 20px; margin-bottom: 6px">🔍 识别整卷错题（OCR 自动分析）</h2>
      <p style="color: var(--muted); font-size: 13px; margin-bottom: 16px">
        上传整张试卷照片（可多页，最多 6 张），系统会用 OCR 提取题目文字，并尝试识别批改标记：
        <b>打叉 / 标「错」/ 扣分＝错误</b>；<b>打勾 / 标「对」＝正确</b>。
        若一道题<b>既打叉又扣分</b>，只计为一次错误。识别后请人工勾选要加入错题集的题目。
      </p>

      <div class="field">
        <label>试卷图片（多页可分别上传）</label>
        <div class="upload-drop" :class="{ drag: dragging }" @click="pickClick" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
          <input type="file" ref="fileInput" accept="image/*" multiple style="display: none" @change="onPick" />
          <div class="upload-hint">点击或拖拽试卷图片到此处（支持 png/jpg/webp/gif，最多 6 张）</div>
        </div>
        <div class="thumb-row">
          <div class="thumb" v-for="(f, i) in files" :key="i">
            <img :src="f.url" alt="" />
            <button type="button" class="thumb-x" @click="removeAt(i)">×</button>
          </div>
        </div>
        <div class="error-tip">{{ tip }}</div>
      </div>

      <div class="field">
        <label>补充说明 / 人工校正（选填，强烈推荐）</label>
        <textarea v-model="supp" placeholder="例如：第3题老师打了叉，第5题只扣了2分…… 也可直接写「第3题错 第5题扣2分」，会参与识别判断，提升准确率。"></textarea>
      </div>

      <div class="field">
        <label>试卷版式（影响识别准确率，不确定选「自动」）</label>
        <select id="layoutFind" class="input" v-model="layout" style="max-width: 220px">
          <option value="auto">自动（推荐）</option>
          <option value="single">单栏 / 一段连续文字</option>
          <option value="double">双栏 / 多栏排版</option>
        </select>
        <div class="meta" style="margin-top: 6px">已自动对图片做<b>灰度 + 二值化 + 分辨率增强</b>处理，可显著提升印刷体识别率。</div>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
        <button class="btn" :disabled="processing" @click="startFind">🔎 开始识别</button>
        <span class="meta">{{ status }}</span>
      </div>
    </div>

    <div v-if="showResult" style="margin-top: 18px">
      <div class="card">
        <div class="row" style="margin-bottom: 12px">
          <span class="title" style="font-size: 18px; color: var(--primary-dark)">🔎 识别结果</span>
        </div>
        <div class="ai-note" style="margin-bottom: 14px" v-html="summaryHtml"></div>

        <div v-if="questions.length" class="find-list">
          <div class="find-item" v-for="(q, idx) in questions" :key="idx">
            <label class="fi-check">
              <input type="checkbox" class="fi-sel" :value="idx" v-model="selected" />
              <span class="badge" :class="badgeClass(q.status)">{{ badgeText(q.status) }}</span>
              <span class="fi-num">
                第 {{ q.number }} 题<span v-if="q.score !== null && q.score !== undefined">　得分：{{ q.score }}</span>
              </span>
            </label>
            <div v-if="q.reason" class="fi-reason">判断依据：{{ q.reason }}</div>
          </div>
          <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap">
            <button class="btn" @click="addSelected">＋ 批量加入错题集（选中）</button>
          </div>
        </div>

        <div v-else class="find-manual">
          <div class="label" style="font-weight: 700; margin-bottom: 6px">手动添加错题</div>
          <p class="meta" style="margin-bottom: 8px">无法自动识别时，可直接输入题号（多个用逗号分隔），系统将记为错题并跳转新增页：</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <input type="text" v-model="manualNums" class="input" placeholder="例如：3, 5, 8" style="max-width: 240px" />
            <button class="btn" @click="manualAdd">＋ 手动加入</button>
          </div>
        </div>

        <details class="ai-raw" style="margin-top: 16px">
          <summary>OCR 原始文字（供人工核对）</summary>
          <pre class="ai-raw-text">{{ rawText }}</pre>
        </details>
        <div class="ai-note">⚠️ 以上由 OCR 自动识别，可能有误，请人工核对后再加入错题集。</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { parsePaper } from '@/utils/aiFindParse';
import { toastError, toastWarning, toastSuccess } from '@/store/ui';

const MAX = 6;
const files = reactive([]); // {file, url}
const supp = ref('');
const layout = ref('auto');
const tip = ref('');
const status = ref('');
const processing = ref(false);
const dragging = ref(false);
const fileInput = ref(null);

const questions = ref([]);
const wrongCount = ref(0);
const rawText = ref('');
const selected = ref([]);
const manualNums = ref('');

const showResult = computed(() => processing.value === false && (questions.value.length > 0 || rawText.value !== '' || status.value.includes('失败') || status.value.includes('离线')));
const summaryHtml = computed(() => {
  if (questions.value.length)
    return `共识别 <b>${questions.value.length}</b> 道题，其中 <b style="color:var(--danger)">${wrongCount.value}</b> 道疑似错题 / 需关注（已自动去重，打叉 + 扣分只计一次）。请勾选要加入错题集的题目。`;
  return `未从图片中自动分割出题目。可查看下方 OCR 原文人工判断，或使用「手动添加」。`;
});

function badgeClass(s) {
  return {
    wrong: 'badge-wrong',
    partial: 'badge-partial',
    correct: 'badge-correct',
    unknown: 'badge-unknown',
  }[s] || 'badge-unknown';
}
function badgeText(s) {
  return { wrong: '错误', partial: '部分扣分', correct: '正确', unknown: '待确认' }[s] || '待确认';
}

function pickClick() {
  fileInput.value && fileInput.value.click();
}
function onPick(e) {
  addFiles(e.target.files);
  e.target.value = '';
}
function onDrop(e) {
  dragging.value = false;
  addFiles(e.dataTransfer.files);
}
function addFiles(list) {
  tip.value = '';
  for (const f of list) {
    if (!f.type || !f.type.startsWith('image/')) {
      tip.value = '只能上传图片文件';
      continue;
    }
    if (files.length >= MAX) {
      tip.value = `最多上传 ${MAX} 张图片`;
      break;
    }
    files.push({ file: f, url: URL.createObjectURL(f) });
  }
}
function removeAt(i) {
  const f = files[i];
  if (f) URL.revokeObjectURL(f.url);
  files.splice(i, 1);
}

/** 加载图片为 Image 对象 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

/** 灰度 + Otsu 二值化 + 分辨率增强（含暗底反相） */
function preprocess(img) {
  const MIN = 1600,
    MAXD = 2200;
  let w = img.width,
    h = img.height;
  const longest = Math.max(w, h) || 1;
  let scale = 1;
  if (longest < MIN) scale = MIN / longest;
  else if (longest > MAXD) scale = MAXD / longest;
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  const hist = new Array(256).fill(0);
  const total = d.length / 4;
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0,
    wB = 0,
    maxVar = 0,
    thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB,
      mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      thr = t;
    }
  }
  let black = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] >= thr ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    if (v === 0) black++;
  }
  if (black / total > 0.5) {
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] === 0 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function countQuestions(text) {
  try {
    return parsePaper(text).questions.filter((q) => q.number !== '未编号').length;
  } catch (e) {
    return 0;
  }
}

async function startFind() {
  if (!files.length) {
    tip.value = '请至少上传一张试卷图片';
    return;
  }
  if (typeof window.Tesseract === 'undefined' || !window.Tesseract.createWorker) {
    toastError('OCR 引擎加载失败（可能处于离线环境），请联网后重试，或使用下方「手动添加」');
    rawText.value = '';
    questions.value = [];
    wrongCount.value = 0;
    status.value = 'OCR 引擎离线，请使用手动添加';
    return;
  }
  processing.value = true;
  questions.value = [];
  rawText.value = '';
  status.value = '正在初始化 OCR 引擎（首次需下载中文模型，请稍候）…';
  let worker;
  try {
    worker = await window.Tesseract.createWorker('chi_sim+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') status.value = `识别中 ${Math.round(m.progress * 100)}%`;
        else if (m.status === 'loading language traineddata' || m.status === 'initializing tesseract')
          status.value = '正在加载中文识别模型…';
      },
    });
  } catch (e) {
    processing.value = false;
    status.value = 'OCR 引擎初始化失败';
    toastError('OCR 引擎初始化失败：' + (e && e.message ? e.message : '未知错误'));
    return;
  }

  let combined = '';
  try {
    for (let i = 0; i < files.length; i++) {
      status.value = `正在处理第 ${i + 1}/${files.length} 张（图像增强 + OCR）…`;
      const img = await loadImage(files[i].file);
      const canvas = preprocess(img);
      let psm = layout.value === 'double' ? 3 : 6;
      let data = (await worker.recognize(canvas, { tessedit_pageseg_mode: psm })).data;
      if (layout.value === 'auto' && countQuestions(data.text) < 2) {
        const alt = (await worker.recognize(canvas, { tessedit_pageseg_mode: psm === 6 ? 3 : 6 })).data;
        if (countQuestions(alt.text) > countQuestions(data.text)) data = alt;
      }
      combined += '\n' + (data.text || '');
    }
  } catch (e) {
    processing.value = false;
    status.value = 'OCR 识别失败';
    toastError('OCR 识别失败：' + (e && e.message ? e.message : '未知错误'));
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
    return;
  }
  try {
    await worker.terminate();
  } catch (_) {}

  if (supp.value.trim()) combined += '\n' + supp.value.trim();
  const res = parsePaper(combined);
  questions.value = res.questions;
  wrongCount.value = res.wrongCount;
  rawText.value = combined.trim();
  selected.value = res.questions.map((q, i) => (q.status === 'wrong' ? i : null)).filter((x) => x !== null);
  processing.value = false;
  status.value = '';
}

function addToErrorSet(q) {
  const title = `第 ${q.number} 题（来自试卷）`;
  const analysis = q.reason
    ? `OCR 识别为疑似错题，判断依据：${q.reason}\n（请补充正确解法与自己的错因）`
    : '（请补充正确解法与自己的错因）';
  const qstr = `title=${encodeURIComponent(title)}&analysis=${encodeURIComponent(analysis)}`;
  window.open(`/add?${qstr}`, '_blank');
}

function addSelected() {
  if (!selected.value.length) {
    toastWarning('请先勾选要加入的题目');
    return;
  }
  selected.value.forEach((i) => addToErrorSet(questions.value[i]));
  toastSuccess(`已为你打开 ${selected.value.length} 个新增页（请逐一补充答案与错因）`);
}

function manualAdd() {
  const v = manualNums.value.trim();
  const nums = v
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!nums.length) {
    toastWarning('请输入题号');
    return;
  }
  nums.forEach((n) => addToErrorSet({ number: n, reason: '手动添加' }));
  toastSuccess(`已打开 ${nums.length} 个新增页`);
}
</script>
