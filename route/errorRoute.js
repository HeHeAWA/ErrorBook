/**
 * errorRoute.js —— 错题相关接口路由层
 * 功能：错题增删改、点赞/收藏、公开列表、我的列表、详情、排行榜。
 * 约定：handler(req, res, ctx) 返回 { code, msg, data }；ctx.userId 由 server 鉴权后注入。
 * 依赖：../service/errorService.js
 */
const errorService = require('../service/errorService');
const imageService = require('../service/imageService');

// 新增错题（需登录）
async function add(req, res, { body, userId }) {
  const r = await errorService.addError({ ...body, userId });
  return { code: 200, msg: r.msg, data: { error: r.error } };
}

// 修改错题（需登录 + 仅作者）
async function update(req, res, { body, userId }) {
  const r = await errorService.updateError({ ...body, userId });
  return { code: 200, msg: r.msg, data: {} };
}

// 删除错题（需登录 + 仅作者）
async function del(req, res, { body, userId }) {
  const r = await errorService.deleteError({ ...body, userId });
  return { code: 200, msg: r.msg, data: {} };
}

// 点赞 / 取消点赞（需登录）
async function like(req, res, { body, userId }) {
  const r = await errorService.toggleLike({ errorId: body.errorId, userId });
  return { code: 200, msg: r.liked ? '已点赞' : '已取消点赞', data: { liked: r.liked, likeCount: r.likeCount } };
}

// 收藏 / 取消收藏（需登录）
async function collect(req, res, { body, userId }) {
  const r = await errorService.toggleCollect({ errorId: body.errorId, userId });
  return { code: 200, msg: r.collected ? '已收藏' : '已取消收藏', data: { collected: r.collected, collectCount: r.collectCount } };
}

// 公开错题列表（公开）
async function list(req, res, { query, userId }) {
  const r = await errorService.listPublic({ ...query, userId });
  return { code: 200, msg: 'ok', data: r };
}

// 我的错题列表（需登录）
async function my(req, res, { query, userId }) {
  const r = await errorService.listMine({ ...query, userId });
  return { code: 200, msg: 'ok', data: r };
}

// 错题详情（公开；私有题非作者拦截）
async function detail(req, res, { query, userId }) {
  const r = await errorService.getDetail({ ...query, userId });
  return { code: 200, msg: 'ok', data: r };
}

// 错题排行榜（公开）
async function rank(req, res, { query }) {
  const r = await errorService.getRank({ ...query });
  return { code: 200, msg: 'ok', data: r };
}

// 个人错题分析报告（需登录）：类型/年级分布 + 复习建议
async function report(req, res, { userId }) {
  const r = await errorService.report({ userId });
  return { code: 200, msg: 'ok', data: r };
}

// 当日待复习列表（需登录）：基于艾宾浩斯曲线，按提交时间算出今天该复习的题
async function reviewList(req, res, { query, userId }) {
  const r = await errorService.getReviewList({ userId });
  return { code: 200, msg: 'ok', data: r };
}

// 标记某题今日已复习（需登录 + 仅作者）：将到期且未复习的阶段标记完成
async function reviewMark(req, res, { body, userId }) {
  const r = await errorService.markReviewed({ errorId: body.errorId, userId });
  return { code: 200, msg: `已记录复习（${r.marked} 个阶段）`, data: { meta: r.meta, marked: r.marked } };
}

// 图片上传（需登录；multipart/form-data，字段 images 多文件 + 可选 errorId）
async function upload(req, res, { multipart, userId }) {
  // 仅取 name=images 的文件部分
  const files = (multipart && multipart.files ? multipart.files : []).filter((f) => f.name === 'images');
  const errorId = multipart && multipart.fields ? multipart.fields.errorId : undefined;
  const r = await imageService.uploadImages({ userId, errorId, files });
  // 关联到错题（编辑/补充图片场景）：将 URL 持久化，删除时方可级联清理
  if (errorId) {
    await errorService.addImages({ userId, errorId: Number(errorId), urls: r.images });
  }
  return { code: 200, msg: '上传成功', data: { images: r.images } };
}

module.exports = { add, update, del, like, collect, list, my, detail, rank, report, upload, reviewList, reviewMark };
