/**
 * cross.js —— 跨域处理中间件
 * 功能：仅允许本地 localhost 访问，限制请求头，拦截非法跨域请求。
 * 依赖：Node 内置
 */

/**
 * 判断来源是否为本地 localhost
 * @param {string} origin 请求 Origin 头
 * @returns {boolean}
 */
function isLocalOrigin(origin) {
  if (!origin) return true; // 同源页面导航通常不带 Origin
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/**
 * 为响应设置跨域头（仅本地）
 * @param {object} res
 * @param {object} req
 * @returns {boolean} 是否放行（非法跨域返回 false）
 */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && !isLocalOrigin(origin)) {
    // 非法跨域来源：拦截
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 403, msg: '非法跨域请求已被拦截', data: {} }));
    return false;
  }
  // 允许的源（回显本地来源）
  res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-session-id, Authorization'
  );
  return true;
}

/**
 * 处理预检 OPTIONS 请求
 */
function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    if (!applyCors(req, res)) return true; // 已拦截
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

module.exports = { applyCors, handleOptions, isLocalOrigin };
