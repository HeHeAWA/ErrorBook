/**
 * imageService.js —— 图片上传业务逻辑层
 * 功能：
 *   1. 接收已解析的 multipart 文件，做类型 / 大小 / 数量三层校验；
 *   2. 生成安全文件名并落地到 /public/img/uploads/（仅本系统托管，杜绝路径穿越）；
 *   3. 编辑场景：校验错题存在且归属本人，并限制「已有 + 新增」不超过上限；
 *   4. 删除错题 / 移除图片时同步清理磁盘物理文件，避免脏文件堆积。
 * 依赖：Node 内置 fs/path/crypto、../tools/fileOpt.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, readJson, logError } = require('../tools/fileOpt');

// 上传目录：/public/img/uploads/（受静态托管，可直接通过 /img/uploads/xxx 访问）
const UPLOAD_DIR = path.join(ROOT, 'public', 'img', 'uploads');

// 允许的图片 MIME 与对应扩展名（白名单，防止伪装类型）
const ALLOWED_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_SIZE = 2 * 1024 * 1024; // 单张图片上限 2MB
const MAX_COUNT = 5; // 每个错题最多 5 张

/**
 * 启动钩子：确保上传目录存在（缺失自动创建）
 */
function ensureUploadDir() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    logError('创建上传目录失败: ' + e.message);
  }
}

/**
 * 上传图片
 * @param {object} p { userId, errorId?(编辑时必传), files:[{filename,contentType,buffer}] }
 * @returns {Promise<{images:string[]}>} 返回可访问的相对 URL 数组
 * @throws {object} {code,msg} 校验失败 / 权限不足 / 写入失败
 */
async function uploadImages({ userId, errorId, files }) {
  if (!files || files.length === 0) throw { code: 400, msg: '未选择任何图片' };

  // ① 逐张校验类型与大小
  for (const f of files) {
    const ext = ALLOWED_TYPE[f.contentType];
    if (!ext) throw { code: 400, msg: '仅支持 JPG/PNG/GIF/WEBP 图片格式' };
    if (!Buffer.isBuffer(f.buffer) || f.buffer.length === 0) throw { code: 400, msg: '图片内容为空' };
    if (f.buffer.length > MAX_SIZE) throw { code: 400, msg: '单张图片不能超过 2MB' };
  }

  // ② 编辑场景：校验错题归属与数量上限（在落盘前拦截，避免产生脏文件）
  let existingCount = 0;
  if (errorId) {
    const eid = Number(errorId);
    const errors = await readJson('error.json');
    const e = errors.find((x) => x.errorId === eid);
    if (!e) throw { code: 400, msg: '错题不存在' };
    if (e.authorUserId !== userId) throw { code: 403, msg: '仅本人可上传本题图片' };
    existingCount = Array.isArray(e.images) ? e.images.length : 0;
    if (existingCount + files.length > MAX_COUNT) {
      throw { code: 400, msg: `每个错题最多 ${MAX_COUNT} 张图片，当前还可上传 ${Math.max(0, MAX_COUNT - existingCount)} 张` };
    }
  }

  // ③ 落盘：生成随机安全文件名（含用户ID+时间戳+随机串，杜绝覆盖/遍历）
  const urls = [];
  for (const f of files) {
    const ext = ALLOWED_TYPE[f.contentType];
    const rand = crypto.randomBytes(6).toString('hex');
    const name = `e${userId}_${Date.now()}_${rand}.${ext}`;
    const full = path.join(UPLOAD_DIR, name);
    try {
      fs.writeFileSync(full, f.buffer);
    } catch (e) {
      logError('图片写入失败: ' + e.message);
      throw { code: 500, msg: '图片保存失败' };
    }
    urls.push('/img/uploads/' + name);
  }
  return { images: urls };
}

/**
 * 同步删除磁盘图片文件（仅允许删除 uploads 目录内文件，防穿越）
 * @param {string[]} images 相对 URL 数组，如 ['/img/uploads/xxx.jpg']
 */
function removeImageFiles(images) {
  if (!Array.isArray(images)) return;
  for (const url of images) {
    if (typeof url !== 'string') continue;
    const name = path.basename(url); // 取文件名，丢弃任何路径前缀
    const full = path.join(UPLOAD_DIR, name);
    // 二次确认仍在 uploads 目录内
    if (!full.startsWith(UPLOAD_DIR)) continue;
    try { fs.unlinkSync(full); } catch (_) { /* 文件不存在忽略 */ }
  }
}

module.exports = { ensureUploadDir, uploadImages, removeImageFiles, MAX_COUNT, MAX_SIZE, UPLOAD_DIR };
