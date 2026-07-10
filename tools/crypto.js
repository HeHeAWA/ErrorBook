/**
 * crypto.js —— 密码加密工具
 * 功能：对用户密码进行 MD5 加盐加密（固定盐值），禁止明文存储、禁止无盐 MD5。
 * 依赖：Node 内置 crypto 模块
 */
const crypto = require('crypto');

// 固定盐值（需求指定，不可修改）
const SALT = '错题系统2026';

/**
 * 对明文密码进行 MD5 加盐加密
 * @param {string} password 明文密码
 * @returns {string} 32 位小写十六进制密文
 */
function md5Salt(password) {
  // 拼接盐值后做 MD5 摘要；统一转字符串防止类型问题
  return crypto
    .createHash('md5')
    .update(String(password) + SALT, 'utf8')
    .digest('hex');
}

/**
 * 校验明文密码与密文是否匹配（用于登录、改密）
 * @param {string} password 明文
 * @param {string} hash 已加盐密文
 * @returns {boolean} 是否匹配
 */
function verify(password, hash) {
  return md5Salt(password) === hash;
}

module.exports = { md5Salt, verify, SALT };
