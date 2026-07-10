/**
 * userRoute.js —— 用户相关接口路由层
 * 功能：注册 / 登录 / 登出 / 资料修改 / 信息查询。
 * 约定：handler(req, res, ctx) 返回 { code, msg, data }；异常由 server.js 统一捕获。
 * 依赖：../service/userService.js、../middleware/auth.js
 */
const userService = require('../service/userService');
const auth = require('../middleware/auth');

// 注册（无需登录）
async function register(req, res, { body }) {
  const r = await userService.register(body);
  return { code: 200, msg: '注册成功，请登录', data: { user: r.user } };
}

// 登录（无需登录）：成功后种入 HttpOnly Cookie(sid)
async function login(req, res, { body }) {
  const r = await userService.login(body);
  res.setHeader('Set-Cookie', `sid=${r.sid}; Max-Age=1800; Path=/; HttpOnly`);
  return { code: 200, msg: '登录成功', data: { user: r.user, expireTime: r.expireTime } };
}

// 登出（需登录）：清除服务端会话与客户端 Cookie
async function logout(req, res) {
  const sid = auth.parseCookies(req).sid;
  await userService.logout(sid);
  res.setHeader('Set-Cookie', `sid=; Max-Age=0; Path=/; HttpOnly`);
  return { code: 200, msg: '已退出登录', data: {} };
}

// 当前用户信息（需登录）
async function info(req, res, { userId }) {
  const r = await userService.getUserInfo(userId);
  return { code: 200, msg: 'ok', data: { user: r.user } };
}

// 修改资料（需登录）
async function update(req, res, { body, userId }) {
  const r = await userService.updateProfile({ ...body, userId });
  return { code: 200, msg: r.msg, data: { user: r.user } };
}

module.exports = { register, login, logout, info, update };
