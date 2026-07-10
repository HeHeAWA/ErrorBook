/**
 * validator.js —— 后端参数统一校验
 * 功能：所有接口入参在此做全量二次校验（优先级高于前端），含：
 *   - 年级 / 错误类型 枚举强校验
 *   - 用户名纯英文 4-16 位
 *   - 昵称 2-20、简介 ≤50、题目 1-500、答案 1-1000、解析 1-2000
 *   - 空值拦截、长度超限自动截断并提示
 *   - XSS 过滤（去标签、去事件处理器、去危险协议/标签词）
 *   - 头像 URL 必须以 http/https 开头
 * 依赖：无
 */

// 年级枚举（固定，禁止增减）
const GRADE_ENUM = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三', '高一', '高二', '高三', '大学', '其他',
];

// 错误类型枚举（固定）
const TYPE_ENUM = ['计算失误', '概念混淆', '审题错误', '记忆遗漏', '其他'];

// 学科枚举（固定，禁止增减）
const SUBJECT_ENUM = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '其他'];

/**
 * XSS 过滤：剥离可能用于注入的 HTML 标签与事件
 * @param {string} str 原始字符串
 * @returns {string} 过滤后的安全字符串
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<\/?[^>]*>/g, '') // 去除所有 HTML 标签 <...>
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '') // 去除 on* 事件属性
    .replace(/javascript:/gi, '') // 去除 javascript: 协议
    .replace(/script|iframe|object|embed|vbscript/gi, '') // 去除危险标签词
    .trim();
}

/** 是否为非空字符串 */
function notEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * 校验用户名（纯英文字母 4-16 位）
 */
function validateUsername(u) {
  if (!notEmpty(u)) return { ok: false, msg: '用户名不能为空' };
  if (!/^[a-zA-Z]{4,16}$/.test(u.trim())) return { ok: false, msg: '用户名须为 4-16 位纯英文字母' };
  return { ok: true, value: u.trim() };
}

/**
 * 校验昵称（2-20 字符，可修改）
 */
function validateNickname(n) {
  if (!notEmpty(n)) return { ok: false, msg: '昵称不能为空' };
  const t = n.trim();
  if (t.length < 2 || t.length > 20) return { ok: false, msg: '昵称须为 2-20 字符' };
  return { ok: true, value: sanitize(t) };
}

/**
 * 校验密码（6-20 位，非空）
 */
function validatePassword(p) {
  if (!notEmpty(p)) return { ok: false, msg: '密码不能为空' };
  const t = p;
  if (t.length < 6 || t.length > 20) return { ok: false, msg: '密码须为 6-20 位' };
  return { ok: true, value: t };
}

/**
 * 校验两次密码一致
 */
function validateConfirm(p, cp) {
  if (String(p) !== String(cp)) return { ok: false, msg: '两次输入的密码不一致' };
  return { ok: true, value: p };
}

/**
 * 校验简介（最大 50 字符，可空）
 */
function validateBio(b) {
  if (b === undefined || b === null || b === '') return { ok: true, value: '' };
  const t = String(b).trim();
  if (t.length > 50) return { ok: false, msg: '个人简介不能超过 50 字符' };
  return { ok: true, value: sanitize(t) };
}

/**
 * 校验题目（1-500）
 */
function validateTitle(t) {
  if (!notEmpty(t)) return { ok: false, msg: '题目不能为空' };
  let v = t.trim();
  if (v.length > 500) v = v.slice(0, 500); // 超长截断（边界场景 11）
  return { ok: true, value: sanitize(v), truncated: t.trim().length > 500 };
}

/**
 * 校验标准答案（1-1000）
 */
function validateAnswer(a) {
  if (!notEmpty(a)) return { ok: false, msg: '标准答案不能为空' };
  let v = a.trim();
  if (v.length > 1000) v = v.slice(0, 1000);
  return { ok: true, value: sanitize(v), truncated: a.trim().length > 1000 };
}

/**
 * 校验解析（1-2000）
 */
function validateAnalysis(a) {
  if (!notEmpty(a)) return { ok: false, msg: '解析不能为空' };
  let v = a.trim();
  if (v.length > 2000) v = v.slice(0, 2000);
  return { ok: true, value: sanitize(v), truncated: a.trim().length > 2000 };
}

/**
 * 校验错误类型（枚举强校验）
 */
function validateType(t) {
  if (!TYPE_ENUM.includes(t)) return { ok: false, msg: '错误类型参数非法' };
  return { ok: true, value: t };
}

/**
 * 校验年级（枚举强校验，边界场景 13）
 */
function validateGrade(g) {
  if (!GRADE_ENUM.includes(g)) return { ok: false, msg: '年级参数非法' };
  return { ok: true, value: g };
}

/**
 * 校验学科（枚举强校验）
 */
function validateSubject(s) {
  if (!SUBJECT_ENUM.includes(s)) return { ok: false, msg: '学科参数非法' };
  return { ok: true, value: s };
}

/**
 * 校验头像 URL（可空；非空时必须以 http/https 开头）
 */
function validateAvatar(url) {
  if (url === undefined || url === null || url === '') return { ok: true, value: '' };
  const t = String(url).trim();
  if (!/^https?:\/\//i.test(t)) return { ok: false, msg: '头像链接须以 http/https 开头' };
  return { ok: true, value: t };
}

/**
 * 校验布尔 isPublic
 */
function validateBool(b) {
  return b === true || b === 'true' || b === 1 || b === '1';
}

/**
 * 校验错题图片数组
 * 规则：可空；非空时必须是数组、长度 0-5、每项均为本系统托管的相对路径（/img/uploads/ 开头），
 *       拒绝任意外部 URL / 绝对路径，防止存储非法链接与 XSS。
 * @param {any} arr
 * @returns {{ok:boolean,msg?:string,value:string[]}}
 */
function validateImages(arr) {
  if (arr === undefined || arr === null) return { ok: true, value: [] };
  if (!Array.isArray(arr)) return { ok: false, msg: '图片数据格式非法' };
  if (arr.length > 5) return { ok: false, msg: '每个错题最多 5 张图片' };
  for (const u of arr) {
    if (typeof u !== 'string' || !/^\/img\/uploads\//.test(u)) {
      return { ok: false, msg: '图片路径非法' };
    }
  }
  return { ok: true, value: arr };
}

module.exports = {
  GRADE_ENUM,
  TYPE_ENUM,
  SUBJECT_ENUM,
  sanitize,
  notEmpty,
  validateUsername,
  validateNickname,
  validatePassword,
  validateConfirm,
  validateBio,
  validateTitle,
  validateAnswer,
  validateAnalysis,
  validateType,
  validateGrade,
  validateSubject,
  validateAvatar,
  validateBool,
  validateImages,
};
