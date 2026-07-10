/**
 * fileOpt.js —— JSON 文件读写封装（含初始化、容错、文件锁）
 * 功能：
 *   1. 启动时自动创建缺失的 /data 下 JSON 模板文件；
 *   2. 读取时捕获「文件不存在 / JSON 解析失败 / 权限不足」，分别做初始化模板、备份重置、抛出 500；
 *   3. 所有读写经 fileLock 加锁，杜绝并发覆盖；
 *   4. 异常统一写入 /logs/server.log。
 * 依赖：Node 内置 fs/path、../tools/fileLock.js
 */
const fs = require('fs');
const path = require('path');
const { withLock, withMultiLock } = require('./fileLock');

// 项目根目录（server.js 所在目录）
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOG_DIR = path.join(ROOT, 'logs');

// 各数据文件初始化空模板（结构与需求固定，禁止增减字段）
const TEMPLATES = {
  'user.json': [], // 用户主表：数组
  'error.json': [], // 错题主表：数组
  'like.json': [], // 点赞关联表：数组
  'collect.json': [], // 收藏关联表：数组
  'session.json': {}, // 会话存储：对象
  'autoId.json': { nextUserId: 1, nextErrorId: 1, nextLikeId: 1, nextCollectId: 1 }, // 计数器
};

/** 获取某个数据文件的绝对路径 */
function filePath(name) {
  return path.join(DATA_DIR, name);
}

/**
 * 简易错误日志记录
 * @param {string} message 日志内容
 */
function logError(message) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(path.join(LOG_DIR, 'server.log'), line);
  } catch (e) {
    /* 日志写入失败不阻断主流程 */
  }
}

/**
 * 确保单个数据文件存在且可解析；损坏则备份旧文件并重置模板
 * @param {string} name 文件名
 */
function ensureDataFile(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, JSON.stringify(TEMPLATES[name], null, 2), 'utf8');
    return;
  }
  try {
    JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    // 格式错乱：先备份旧文件，再重置为空模板（边界场景 1）
    const backup = fp + '.bak.' + Date.now();
    try {
      fs.copyFileSync(fp, backup);
    } catch (_) {}
    fs.writeFileSync(fp, JSON.stringify(TEMPLATES[name], null, 2), 'utf8');
    logError(`文件 ${name} 解析失败，已备份至 ${backup} 并重置模板。原始错误: ${e.message}`);
  }
}

/** 启动钩子：遍历 /data 目录，缺失文件自动生成初始化模板 JSON（需求 2.3） */
function initAllDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  Object.keys(TEMPLATES).forEach(ensureDataFile);
}

/** 根据模板类型返回空值（数组或对象） */
function emptyOf(name) {
  const t = TEMPLATES[name];
  return Array.isArray(t) ? [] : typeof t === 'object' && t !== null ? {} : t;
}

/**
 * 读取 JSON 文件（加锁）
 * @param {string} name 文件名
 * @returns {Promise<any>} 解析后的数据；文件不存在则创建模板并返回空模板
 * @throws {object} 权限不足 / 解析失败 时抛出 {code:500,msg,err}
 */
async function readJson(name) {
  return withLock(name, async () => {
    try {
      const raw = fs.readFileSync(filePath(name), 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        fs.writeFileSync(filePath(name), JSON.stringify(emptyOf(name), null, 2), 'utf8');
        return emptyOf(name);
      }
      if (e.code === 'EACCES') {
        logError(`读取文件 ${name} 权限不足: ${e.message}`);
        throw { code: 500, msg: '文件读取权限不足', err: e };
      }
      logError(`读取文件 ${name} 解析失败: ${e.message}`);
      throw { code: 500, msg: '数据文件损坏', err: e };
    }
  });
}

/**
 * 写入 JSON 文件（加锁，覆盖式）
 * @param {string} name 文件名
 * @param {any} data 待写入数据
 * @throws {object} 写入失败抛出 {code:500,msg,err}
 */
async function writeJson(name, data) {
  return withLock(name, async () => {
    try {
      fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      logError(`写入文件 ${name} 失败: ${e.message}`);
      throw { code: 500, msg: '数据写入失败', err: e };
    }
  });
}

/**
 * 读取-修改-写入（单文件原子操作，加锁）
 * @param {string} name 文件名
 * @param {Function} mutateFn (data)=>result 直接修改 data 引用，返回需要的结果
 * @returns {Promise<any>} mutateFn 的返回值
 */
async function updateJson(name, mutateFn) {
  return withLock(name, async () => {
    let data;
    try {
      const raw = fs.readFileSync(filePath(name), 'utf8');
      data = JSON.parse(raw);
    } catch (e) {
      if (e.code === 'ENOENT') {
        data = emptyOf(name);
      } else {
        logError(`updateJson 读取 ${name} 失败: ${e.message}`);
        throw { code: 500, msg: '数据读取失败', err: e };
      }
    }
    const result = await mutateFn(data);
    try {
      fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      logError(`updateJson 写入 ${name} 失败: ${e.message}`);
      throw { code: 500, msg: '数据写入失败', err: e };
    }
    return result;
  });
}

/**
 * 多文件事务（读取多个文件→修改→全部写回，整体加锁，原子性）
 * @param {string[]} names 文件名数组
 * @param {Function} mutateFn (datas)=>result，datas 形如 { 'user.json': [...], ... }
 * @returns {Promise<any>} mutateFn 的返回值
 */
async function updateMulti(names, mutateFn) {
  return withMultiLock(names, async () => {
    const datas = {};
    for (const n of names) {
      try {
        const raw = fs.readFileSync(filePath(n), 'utf8');
        datas[n] = JSON.parse(raw);
      } catch (e) {
        if (e.code === 'ENOENT') datas[n] = emptyOf(n);
        else {
          logError(`updateMulti 读取 ${n} 失败: ${e.message}`);
          throw { code: 500, msg: '数据读取失败', err: e };
        }
      }
    }
    const result = await mutateFn(datas);
    for (const n of names) {
      try {
        fs.writeFileSync(filePath(n), JSON.stringify(datas[n], null, 2), 'utf8');
      } catch (e) {
        logError(`updateMulti 写入 ${n} 失败: ${e.message}`);
        throw { code: 500, msg: '数据写入失败', err: e };
      }
    }
    return result;
  });
}

module.exports = {
  ROOT,
  DATA_DIR,
  LOG_DIR,
  TEMPLATES,
  filePath,
  logError,
  initAllDataFiles,
  ensureDataFile,
  readJson,
  writeJson,
  updateJson,
  updateMulti,
};
