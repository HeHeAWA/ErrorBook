/**
 * idGenerator.js —— 全局自增 ID 操作
 * 功能：基于 /data/autoId.json 维护 userId / errorId / likeId / collectId 的自增计数器。
 *       新增数据后原子化 +1 并落盘，防止并发重复；启动时扫描现有数据修复计数器。
 * 依赖：../tools/fileOpt.js
 */
const { readJson, updateJson } = require('./fileOpt');

/**
 * 根据类型获取下一个自增 ID，并原子化自增计数
 * @param {string} type 'user' | 'error' | 'like' | 'collect'
 * @returns {Promise<number>} 分配到的 ID
 */
async function nextId(type) {
  // nextUserId / nextErrorId / nextLikeId / nextCollectId
  const field = 'next' + type.charAt(0).toUpperCase() + type.slice(1) + 'Id';
  return updateJson('autoId.json', (data) => {
    const id = data[field];
    data[field] = id + 1; // 原子自增，落盘在 fileOpt 内完成
    return id;
  });
}

/**
 * 启动时修复计数器：扫描各业务表最大 ID，确保 nextXxxId 大于现有最大值
 * （应对 autoId.json 丢失/错乱场景，见边界场景 9）
 */
async function repairAutoId() {
  const [users, errors, likes, collects] = await Promise.all([
    readJson('user.json'),
    readJson('error.json'),
    readJson('like.json'),
    readJson('collect.json'),
  ]);
  const maxOf = (arr, key) => arr.reduce((m, x) => Math.max(m, Number(x[key]) || 0), 0);
  const maxUserId = maxOf(users, 'userId');
  const maxErrorId = maxOf(errors, 'errorId');
  const maxLikeId = maxOf(likes, 'likeId');
  const maxCollectId = maxOf(collects, 'collectId');

  await updateJson('autoId.json', (data) => {
    data.nextUserId = Math.max(data.nextUserId, maxUserId + 1);
    data.nextErrorId = Math.max(data.nextErrorId, maxErrorId + 1);
    data.nextLikeId = Math.max(data.nextLikeId, maxLikeId + 1);
    data.nextCollectId = Math.max(data.nextCollectId, maxCollectId + 1);
  });
}

module.exports = { nextId, repairAutoId };
