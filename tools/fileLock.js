/**
 * fileLock.js —— 简易文件读写锁（并发安全）
 * 功能：为不同文件（或事务）提供互斥锁，保证同一时刻只有一个操作在读写同一文件，
 *       杜绝并发读写覆盖、数据丢失。支持单文件锁与多文件组合事务锁。
 * 依赖：无
 */

// 锁登记表：key 为锁名（如 "file:user.json"），value 为释放函数构成的 Promise 链
const lockChains = new Map();

/**
 * 获取单个锁（内部使用）
 * @param {string} key 锁名
 * @returns {Promise<Function>} 返回一个 release 释放函数
 */
function acquireOne(key) {
  const prev = lockChains.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => { release = resolve; });
  // 将当前锁挂到链尾，形成顺序执行队列
  lockChains.set(key, prev.then(() => next));
  return prev.then(() => release);
}

/**
 * 获取多个锁（事务），按字典序加锁以避免死锁
 * @param {string[]} keys 锁名数组
 * @returns {Promise<Function>} 释放函数（释放所有锁）
 */
async function acquireMulti(keys) {
  const sorted = Array.from(new Set(keys)).sort();
  const releases = [];
  for (const k of sorted) {
    releases.push(await acquireOne(k));
  }
  return () => releases.forEach((r) => r());
}

/**
 * 携带锁执行函数（单文件）
 * @param {string} name 文件锁名
 * @param {Function} fn 临界区函数（异步）
 * @returns {Promise<any>} fn 的返回值
 */
async function withLock(name, fn) {
  const release = await acquireOne('file:' + name);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * 携带多文件锁执行函数（事务，跨文件原子操作）
 * @param {string[]} names 文件名数组（如 ['error.json','like.json']）
 * @param {Function} fn 临界区函数，参数为各文件数据对象集合 {fileName: data}
 * @returns {Promise<any>} fn 的返回值
 */
async function withMultiLock(names, fn) {
  const release = await acquireMulti(names.map((n) => 'file:' + n));
  try {
    return await fn();
  } finally {
    release();
  }
}

module.exports = { withLock, withMultiLock, acquireOne, acquireMulti };
