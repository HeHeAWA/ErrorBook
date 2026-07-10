/**
 * auth.js —— Session 会话鉴权中间件
 * 功能：
 *   - 基于 Cookie(sid) 与会话文件 /data/session.json 校验登录态；
 *   - Session 过期时长 30 分钟无操作自动失效；
 *   - 全局鉴权：写操作 / 私有数据接口强制校验，未登录统一返回 401；
 *   - 启动时自动清理过期 Session；
 *   - 提供创建 / 删除 / 清理过期会话能力。
 * 依赖：../tools/fileOpt.js
 */
const crypto = require('crypto');
const { readJson, updateJson, updateMulti } = require('../tools/fileOpt');

// Session 过期时长：30 分钟（需求指定）
const SESSION_EXPIRE = 30 * 60 * 1000;

/** 解析请求 Cookie */
function parseCookies(req) {
  const c = req.headers.cookie;
  if (!c) return {};
  return c.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) acc[k] = v;
    }
    return acc;
  }, {});
}

/**
 * 读取并校验当前请求的会话
 * @param {object} req HTTP 请求
 * @returns {Promise<{userId:number,expireTime:number}|null>} 有效返回会话，否则 null
 */
async function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  if (!sid) return null;
  const sessions = await readJson('session.json');
  const s = sessions[sid];
  if (!s) return null;
  if (Date.now() > s.expireTime) {
    // 过期则顺手清除
    await deleteSession(sid);
    return null;
  }
  return s;
}

/**
 * 创建会话（生成 sid + 过期时间并落盘）
 * @param {number} userId 用户 ID
 * @returns {Promise<{sid:string,expireTime:number,userId:number}>}
 */
async function createSession(userId) {
  const sid = crypto.randomBytes(16).toString('hex');
  const expireTime = Date.now() + SESSION_EXPIRE;
  await updateJson('session.json', (data) => {
    data[sid] = { userId, expireTime, createTime: Date.now() };
  });
  return { sid, expireTime, userId };
}

/**
 * 删除会话
 * @param {string} sid
 */
async function deleteSession(sid) {
  if (!sid) return;
  await updateJson('session.json', (data) => {
    delete data[sid];
  });
}

/**
 * 刷新会话过期时间（无操作则重置 30 分钟计时）
 * @param {string} sid
 */
async function refreshSession(sid) {
  if (!sid) return;
  await updateJson('session.json', (data) => {
    if (data[sid]) data[sid].expireTime = Date.now() + SESSION_EXPIRE;
  });
}

/**
 * 启动钩子：清理所有过期 Session（需求 2.3）
 */
async function cleanExpiredSessions() {
  await updateJson('session.json', (data) => {
    const now = Date.now();
    Object.keys(data).forEach((k) => {
      if (now > data[k].expireTime) delete data[k];
    });
  });
}

/**
 * 全局鉴权：校验登录态
 * @param {object} req
 * @returns {Promise<number|null>} 通过返回 userId，否则 null
 */
async function ensureAuth(req) {
  const s = await getSession(req);
  if (!s) return null;
  // 任意鉴权操作视为「有操作」，刷新过期时间
  const cookies = parseCookies(req);
  await refreshSession(cookies.sid);
  return s.userId;
}

module.exports = {
  SESSION_EXPIRE,
  parseCookies,
  getSession,
  createSession,
  deleteSession,
  refreshSession,
  cleanExpiredSessions,
  ensureAuth,
};
