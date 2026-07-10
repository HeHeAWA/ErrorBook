/**
 * userService.js —— 用户业务逻辑层
 * 功能：注册、登录（含暴力破解锁定）、登出、用户信息查询、资料修改（昵称/简介/头像/密码）。
 * 约定：业务函数返回数据对象；失败时抛出 { code, msg }，由路由层捕获并封装响应。
 * 依赖：../tools/fileOpt.js、../tools/crypto.js、../tools/idGenerator.js、../middleware/auth.js
 */
const { readJson, updateJson, updateMulti } = require('../tools/fileOpt');
const { md5Salt, verify } = require('../tools/crypto');
const { nextId } = require('../tools/idGenerator');
const { createSession, deleteSession } = require('../middleware/auth');
const V = require('../middleware/validator');

// 账号连续错误次数上限 & 锁定时长
const MAX_WRONG = 5;
const LOCK_DURATION = 10 * 60 * 1000; // 10 分钟

/** 从用户表中剔除密码等敏感字段 */
function publicUser(u) {
  if (!u) return null;
  const { password, wrongPwdCount, ...rest } = u;
  return rest;
}

/** 按用户名查找用户（仅字母，精确匹配） */
async function findByUsername(username) {
  const users = await readJson('user.json');
  return users.find((u) => u.username === username) || null;
}

/**
 * 注册
 * @param {object} p {username, nickname, password, confirmPassword}
 */
async function register(p) {
  const u = V.validateUsername(p.username);
  if (!u.ok) throw { code: 400, msg: u.msg };
  const n = V.validateNickname(p.nickname);
  if (!n.ok) throw { code: 400, msg: n.msg };
  const pw = V.validatePassword(p.password);
  if (!pw.ok) throw { code: 400, msg: pw.msg };
  const cp = V.validateConfirm(p.password, p.confirmPassword);
  if (!cp.ok) throw { code: 400, msg: cp.msg };

  const exist = await findByUsername(u.value);
  if (exist) throw { code: 409, msg: '用户名已存在' }; // 数据冲突

  const userId = await nextId('user');
  const user = {
    userId,
    username: u.value,
    password: md5Salt(pw.value),
    nickname: n.value,
    bio: '',
    avatarUrl: '',
    score: 0,
    ownErrorIds: [],
    collectErrorIds: [],
    lockTime: 0,
    wrongPwdCount: 0,
    createTime: Date.now(),
  };
  await updateJson('user.json', (data) => {
    data.push(user);
  });
  return { user: publicUser(user) };
}

/**
 * 登录（含暴力破解锁定逻辑）
 * @param {object} p {username, password}
 */
async function login(p) {
  const u = V.validateUsername(p.username);
  if (!u.ok) throw { code: 400, msg: '用户名或密码错误' };
  const pw = V.validatePassword(p.password);
  if (!pw.ok) throw { code: 400, msg: '用户名或密码错误' };

  const user = await findByUsername(u.value);
  if (!user) throw { code: 400, msg: '用户名或密码错误' };

  // 账号锁定中
  if (user.lockTime && Date.now() < user.lockTime) {
    const remainMin = Math.ceil((user.lockTime - Date.now()) / 60000);
    throw { code: 403, msg: `账号已被锁定，请于 ${remainMin} 分钟后再试`, data: { remainMin } };
  }

  if (!verify(pw.value, user.password)) {
    // 密码错误：累加错误次数
    const updated = await updateJson('user.json', (data) => {
      const target = data.find((x) => x.userId === user.userId);
      target.wrongPwdCount = (target.wrongPwdCount || 0) + 1;
      if (target.wrongPwdCount >= MAX_WRONG) {
        target.lockTime = Date.now() + LOCK_DURATION; // 锁定 10 分钟
        target.wrongPwdCount = 0;
      }
      return target;
    });
    if (updated.lockTime && Date.now() < updated.lockTime) {
      const remainMin = Math.ceil((updated.lockTime - Date.now()) / 60000);
      throw { code: 403, msg: `密码错误次数过多，账号已锁定 ${remainMin} 分钟`, data: { remainMin } };
    }
    throw { code: 400, msg: '用户名或密码错误' };
  }

  // 校验成功：重置错误计数与锁定
  await updateJson('user.json', (data) => {
    const target = data.find((x) => x.userId === user.userId);
    target.wrongPwdCount = 0;
    target.lockTime = 0;
  });

  const session = await createSession(user.userId);
  return { user: publicUser(user), sid: session.sid, expireTime: session.expireTime };
}

/** 登出：删除服务端会话 */
async function logout(sid) {
  await deleteSession(sid);
  return { ok: true };
}

/** 查询当前用户信息 */
async function getUserInfo(userId) {
  const users = await readJson('user.json');
  const user = users.find((x) => x.userId === userId);
  if (!user) throw { code: 401, msg: '用户不存在或会话失效' };
  return { user: publicUser(user) };
}

/**
 * 修改资料（昵称/简介/头像/密码）
 * @param {object} p {userId, nickname?, bio?, avatarUrl?, oldPassword?, newPassword?, confirmPassword?}
 */
async function updateProfile(p) {
  const users = await readJson('user.json');
  const user = users.find((x) => x.userId === p.userId);
  if (!user) throw { code: 401, msg: '用户不存在' };

  let msg = '更新成功';

  // 昵称（可选）
  if (p.nickname !== undefined) {
    const n = V.validateNickname(p.nickname);
    if (!n.ok) throw { code: 400, msg: n.msg };
    user.nickname = n.value;
  }
  // 简介（可选）
  if (p.bio !== undefined) {
    const b = V.validateBio(p.bio);
    if (!b.ok) throw { code: 400, msg: b.msg };
    user.bio = b.value;
  }
  // 头像（可选）
  if (p.avatarUrl !== undefined) {
    const a = V.validateAvatar(p.avatarUrl);
    if (!a.ok) throw { code: 400, msg: a.msg };
    user.avatarUrl = a.value;
  }
  // 修改密码（需原密码匹配）
  if (p.newPassword) {
    if (!p.oldPassword) throw { code: 400, msg: '请输入原密码' };
    if (!verify(p.oldPassword, user.password)) throw { code: 400, msg: '原密码错误' };
    const np = V.validatePassword(p.newPassword);
    if (!np.ok) throw { code: 400, msg: np.msg };
    const cp = V.validateConfirm(p.newPassword, p.confirmPassword);
    if (!cp.ok) throw { code: 400, msg: cp.msg };
    user.password = md5Salt(np.value);
    msg = '资料与密码已更新';
  }

  await updateJson('user.json', (data) => {
    const idx = data.findIndex((x) => x.userId === p.userId);
    if (idx > -1) data[idx] = user;
  });
  return { user: publicUser(user), msg };
}

module.exports = {
  publicUser,
  findByUsername,
  register,
  login,
  logout,
  getUserInfo,
  updateProfile,
};
