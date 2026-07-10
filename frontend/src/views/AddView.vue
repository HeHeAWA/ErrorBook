<template>
  <div class="container" style="max-width: 680px">
    <div class="card" style="margin-top: 24px">
      <h1 class="section-title" style="margin-top: 0">➕ 新增错题</h1>

      <div class="field">
        <label>题目（1-500 字）</label>
        <textarea v-model="title" placeholder="请输入错题题目" @input="refresh" @blur="refresh"></textarea>
        <div class="error-tip">{{ tipTitle }}</div>
      </div>
      <div class="field">
        <label>标准答案（1-1000 字）</label>
        <textarea v-model="answer" placeholder="请输入标准答案" @input="refresh" @blur="refresh"></textarea>
        <div class="error-tip">{{ tipAnswer }}</div>
      </div>
      <div class="field">
        <label>解析（1-2000 字）</label>
        <textarea v-model="analysis" placeholder="请输入解析过程" @input="refresh" @blur="refresh"></textarea>
        <div class="error-tip">{{ tipAnalysis }}</div>
      </div>
      <div class="field">
        <label>错误类型（必选）</label>
        <select v-model="type" class="input" @change="refresh">
          <option value="">请选择</option>
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <div class="error-tip">{{ tipType }}</div>
      </div>
      <div class="field">
        <label>所属年级（必选）</label>
        <select v-model="grade" class="input" @change="refresh">
          <option value="">请选择</option>
          <option v-for="g in GRADES" :key="g" :value="g">{{ g }}</option>
        </select>
        <div class="error-tip">{{ tipGrade }}</div>
      </div>
      <div class="field">
        <label>所属学科（必选）</label>
        <select v-model="subject" class="input" @change="refresh">
          <option value="">请选择</option>
          <option v-for="s in SUBJECTS" :key="s" :value="s">{{ s }}</option>
        </select>
        <div class="error-tip">{{ tipSubject }}</div>
      </div>
      <div class="field">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
          <input type="checkbox" v-model="isPublic" style="width: auto" /> 公开（勾选后所有人可查看）
        </label>
      </div>
      <div class="field">
        <label>错题图片（最多 5 张，单张 ≤ 2MB，支持 JPG/PNG/GIF/WEBP）</label>
        <input type="file" class="input" accept="image/jpeg,image/png,image/gif,image/webp" multiple @change="onPick" />
        <div class="error-tip">{{ tipImages }}</div>
        <div class="img-preview">
          <div class="img-preview-item" v-for="(s, i) in selectedFiles" :key="i">
            <img :src="s.url" alt="" />
            <button type="button" class="img-del" @click="removeAt(i)">×</button>
          </div>
        </div>
      </div>

      <button class="btn" style="width: 100%" :disabled="submitDisabled" @click="submit">提交</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { GRADES, TYPES, SUBJECTS } from '@/utils/format';
import { toastSuccess, toastError } from '@/store/ui';

const route = useRoute();
const router = useRouter();

const title = ref('');
const answer = ref('');
const analysis = ref('');
const type = ref('');
const grade = ref('');
const subject = ref('');
const isPublic = ref(true);

const tipTitle = ref('');
const tipAnswer = ref('');
const tipAnalysis = ref('');
const tipType = ref('');
const tipGrade = ref('');
const tipSubject = ref('');
const tipImages = ref('');

const MAX_IMAGES = 5;
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const selectedFiles = reactive([]); // {file, url}
const submitDisabled = ref(true);

function checkTitle(v) {
  const t = (v || '').trim();
  if (!t) return '题目不能为空';
  if (t.length > 500) return '题目不能超过 500 字';
  return '';
}
function checkAnswer(v) {
  const t = (v || '').trim();
  if (!t) return '标准答案不能为空';
  if (t.length > 1000) return '答案不能超过 1000 字';
  return '';
}
function checkAnalysis(v) {
  const t = (v || '').trim();
  if (!t) return '解析不能为空';
  if (t.length > 2000) return '解析不能超过 2000 字';
  return '';
}
function checkType(v) {
  return v ? '' : '请选择错误类型';
}
function checkGrade(v) {
  return v ? '' : '请选择所属年级';
}
function checkSubject(v) {
  return v ? '' : '请选择所属学科';
}
function checkImages() {
  return selectedFiles.length > MAX_IMAGES ? '图片数量超过上限' : '';
}

function refresh() {
  tipTitle.value = checkTitle(title.value);
  tipAnswer.value = checkAnswer(answer.value);
  tipAnalysis.value = checkAnalysis(analysis.value);
  tipType.value = checkType(type.value);
  tipGrade.value = checkGrade(grade.value);
  tipSubject.value = checkSubject(subject.value);
  tipImages.value = checkImages();
  submitDisabled.value = !(
    !tipTitle.value &&
    !tipAnswer.value &&
    !tipAnalysis.value &&
    !tipType.value &&
    !tipGrade.value &&
    !tipSubject.value &&
    !tipImages.value
  );
}

function onPick(e) {
  const input = e.target;
  const files = Array.from(input.files || []);
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) {
      tipImages.value = '仅支持 JPG/PNG/GIF/WEBP 图片：' + f.name;
      input.value = '';
      return;
    }
    if (f.size > MAX_SIZE) {
      tipImages.value = '单张图片不能超过 2MB：' + f.name;
      input.value = '';
      return;
    }
    if (selectedFiles.length >= MAX_IMAGES) {
      tipImages.value = `每个错题最多上传 ${MAX_IMAGES} 张图片`;
      input.value = '';
      return;
    }
    selectedFiles.push({ file: f, url: URL.createObjectURL(f) });
  }
  tipImages.value = '';
  input.value = '';
  refresh();
}

function removeAt(i) {
  const s = selectedFiles[i];
  if (s) URL.revokeObjectURL(s.url);
  selectedFiles.splice(i, 1);
  refresh();
}

async function submit() {
  refresh();
  if (submitDisabled.value) return;
  submitDisabled.value = true;
  let images = [];
  try {
    if (selectedFiles.length) {
      const fd = new FormData();
      selectedFiles.forEach((s) => fd.append('images', s.file));
      const up = await api.uploadErrorImages(fd);
      if (up.code !== 200) {
        toastError(up.msg || '图片上传失败');
        submitDisabled.value = false;
        return;
      }
      images = up.data.images;
    }
    const r = await api.addError({
      title: title.value.trim(),
      answer: answer.value.trim(),
      analysis: analysis.value.trim(),
      type: type.value,
      grade: grade.value,
      subject: subject.value,
      isPublic: isPublic.value,
      images,
    });
    if (r.code === 200) {
      toastSuccess(r.msg || '新增成功');
      setTimeout(() => router.push('/'), 900);
    } else {
      toastError(r.msg || '提交失败');
      submitDisabled.value = false;
    }
  } catch (e) {
    toastError('提交异常，请重试');
    submitDisabled.value = false;
  }
}

onMounted(() => {
  // 来自「识别错题」页「加入错题集」跳转的预填
  if (route.query.title) title.value = route.query.title;
  if (route.query.answer) answer.value = route.query.answer;
  if (route.query.analysis) analysis.value = route.query.analysis;
  if (route.query.type) type.value = route.query.type;
  if (route.query.grade) grade.value = route.query.grade;
  if (route.query.subject) subject.value = route.query.subject;
  refresh();
});
</script>
