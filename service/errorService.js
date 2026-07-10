/**
 * errorService.js —— 错题业务逻辑层
 * 功能：错题 CRUD、点赞/收藏（含去重与取消）、公开列表/我的列表、详情、错题排行榜统计、年级筛选过滤。
 * 约定：业务函数返回数据对象；失败时抛出 { code, msg }，由路由层捕获并封装响应。
 * 依赖：../tools/fileOpt.js、../tools/idGenerator.js、../middleware/validator.js
 */
const { readJson, updateJson, updateMulti } = require('../tools/fileOpt');
const { nextId } = require('../tools/idGenerator');
const V = require('../middleware/validator');
const { removeImageFiles, MAX_COUNT } = require('./imageService');

const PAGE_SIZE = 10; // 全局统一每页 10 条

/**
 * 艾宾浩斯遗忘曲线复习间隔（距提交错题的天数）：
 * 第 1 / 2 / 4 / 7 / 15 / 30 天各复习一次，共 6 个阶段。
 */
const REVIEW_STAGES = [1, 2, 4, 7, 15, 30];
const TOTAL_STAGES = REVIEW_STAGES.length;
const DAY = 24 * 60 * 60 * 1000;

/** 取某时间戳所在「当天 0 点」的毫秒值（用于按日期比较，忽略具体时分秒） */
function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 计算某错题第 stageIndex 个阶段的计划复习日期（当天 0 点） */
function scheduledDate(error, stageIndex) {
  return startOfDay(error.createTime) + REVIEW_STAGES[stageIndex] * DAY;
}

/**
 * 读取点赞/收藏计数与记录，构建统计上下文
 */
async function buildStatsContext() {
  const [errors, likes, collects, users] = await Promise.all([
    readJson('error.json'),
    readJson('like.json'),
    readJson('collect.json'),
    readJson('user.json'),
  ]);
  const likeCount = {};
  const collectCount = {};
  likes.forEach((l) => { likeCount[l.errorId] = (likeCount[l.errorId] || 0) + 1; });
  collects.forEach((c) => { collectCount[c.errorId] = (collectCount[c.errorId] || 0) + 1; });
  const userMap = {};
  users.forEach((u) => { userMap[u.userId] = u.nickname; });
  return { errors, likes, collects, likeCount, collectCount, userMap };
}

/**
 * 将单条错题与统计信息合并，附带作者昵称、点赞/收藏数、当前用户是否点赞/收藏
 */
function enrich(e, ctx, userId) {
  const eid = e.errorId;
  return {
    ...e,
    likeCount: ctx.likeCount[eid] || 0,
    collectCount: ctx.collectCount[eid] || 0,
    liked: userId ? ctx.likes.some((l) => l.errorId === eid && l.userId === userId) : false,
    collected: userId ? ctx.collects.some((c) => c.errorId === eid && c.userId === userId) : false,
    authorNickname: ctx.userMap[e.authorUserId] || '匿名',
  };
}

/** 分页工具 */
function paginate(arr, page) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (p - 1) * PAGE_SIZE;
  return { list: arr.slice(start, start + PAGE_SIZE), page: p, pageSize: PAGE_SIZE, total, totalPages };
}

/**
 * 新增错题
 * @param {object} p {userId, title, answer, analysis, type, grade, subject, isPublic}
 */
async function addError(p) {
  const title = V.validateTitle(p.title); if (!title.ok) throw { code: 400, msg: title.msg };
  const answer = V.validateAnswer(p.answer); if (!answer.ok) throw { code: 400, msg: answer.msg };
  const analysis = V.validateAnalysis(p.analysis); if (!analysis.ok) throw { code: 400, msg: analysis.msg };
  const type = V.validateType(p.type); if (!type.ok) throw { code: 400, msg: type.msg };
  const grade = V.validateGrade(p.grade); if (!grade.ok) throw { code: 400, msg: grade.msg };
  const subject = V.validateSubject(p.subject); if (!subject.ok) throw { code: 400, msg: subject.msg };
  const isPublic = V.validateBool(p.isPublic);
  // 图片数组校验（最多 5 张，仅允许本系统托管的 /img/uploads/ 路径）
  const images = V.validateImages(p.images);
  if (!images.ok) throw { code: 400, msg: images.msg };

  const errorId = await nextId('error');
  const now = Date.now();
  const error = {
    errorId,
    authorUserId: p.userId,
    title: title.value,
    answer: answer.value,
    analysis: analysis.value,
    type: type.value,
    grade: grade.value,
    subject: subject.value,
    isPublic,
    images: images.value,
    createTime: now,
    updateTime: now,
  };
  // 事务：写入错题表 + 同步到作者 ownErrorIds
  await updateMulti(['error.json', 'user.json'], (datas) => {
    datas['error.json'].push(error);
    const u = datas['user.json'].find((x) => x.userId === p.userId);
    if (u) u.ownErrorIds.push(errorId);
  });

  const note = [title.truncated, answer.truncated, analysis.truncated].some(Boolean)
    ? '（部分内容超长已自动截断）' : '';
  return { error, msg: '新增错题成功' + note };
}

/**
 * 修改错题（仅作者）
 * @param {object} p {userId, errorId, title?, answer?, analysis?, type?, grade?, isPublic?}
 */
async function updateError(p) {
  const errorId = Number(p.errorId);
  if (!errorId) throw { code: 400, msg: '错题ID参数错误' };

  const patch = {};
  let truncated = false;
  if (p.title !== undefined) { const r = V.validateTitle(p.title); if (!r.ok) throw { code: 400, msg: r.msg }; patch.title = r.value; truncated = truncated || r.truncated; }
  if (p.answer !== undefined) { const r = V.validateAnswer(p.answer); if (!r.ok) throw { code: 400, msg: r.msg }; patch.answer = r.value; truncated = truncated || r.truncated; }
  if (p.analysis !== undefined) { const r = V.validateAnalysis(p.analysis); if (!r.ok) throw { code: 400, msg: r.msg }; patch.analysis = r.value; truncated = truncated || r.truncated; }
  if (p.type !== undefined) { const r = V.validateType(p.type); if (!r.ok) throw { code: 400, msg: r.msg }; patch.type = r.value; }
  if (p.grade !== undefined) { const r = V.validateGrade(p.grade); if (!r.ok) throw { code: 400, msg: r.msg }; patch.grade = r.value; }
  if (p.subject !== undefined) { const r = V.validateSubject(p.subject); if (!r.ok) throw { code: 400, msg: r.msg }; patch.subject = r.value; }
  if (p.isPublic !== undefined) { patch.isPublic = V.validateBool(p.isPublic); }
  if (p.images !== undefined) {
    const r = V.validateImages(p.images);
    if (!r.ok) throw { code: 400, msg: r.msg };
    patch.images = r.value;
  }

  const ok = await updateJson('error.json', (data) => {
    const e = data.find((x) => x.errorId === errorId);
    if (!e) return false;
    if (e.authorUserId !== p.userId) return 'forbidden';
    // 图片被移除时同步删除磁盘物理文件
    if (patch.images) {
      const old = Array.isArray(e.images) ? e.images : [];
      const removed = old.filter((u) => !patch.images.includes(u));
      if (removed.length) removeImageFiles(removed);
    }
    Object.assign(e, patch);
    e.updateTime = Date.now();
    return true;
  });
  if (ok === false) throw { code: 400, msg: '错题不存在或已删除' };
  if (ok === 'forbidden') throw { code: 403, msg: '仅本人可编辑自己的错题' };

  return { msg: '更新成功' + (truncated ? '（部分内容超长已截断）' : '') };
}

/**
 * 删除错题（仅作者）：级联清除点赞、收藏及用户关联
 * @param {object} p {userId, errorId}
 */
async function deleteError(p) {
  const errorId = Number(p.errorId);
  if (!errorId) throw { code: 400, msg: '错题ID参数错误' };

  let removedImages = null;
  const result = await updateMulti(
    ['error.json', 'like.json', 'collect.json', 'user.json'],
    (datas) => {
      const e = datas['error.json'].find((x) => x.errorId === errorId);
      if (!e) return 'notfound';
      if (e.authorUserId !== p.userId) return 'forbidden';
      // 记录待清理的图片物理文件
      removedImages = Array.isArray(e.images) ? e.images.slice() : [];
      // 1. 删除错题
      datas['error.json'] = datas['error.json'].filter((x) => x.errorId !== errorId);
      // 2. 删除其点赞
      datas['like.json'] = datas['like.json'].filter((x) => x.errorId !== errorId);
      // 3. 删除其收藏
      datas['collect.json'] = datas['collect.json'].filter((x) => x.errorId !== errorId);
      // 4. 用户 ownErrorIds / collectErrorIds 移除
      datas['user.json'].forEach((u) => {
        u.ownErrorIds = (u.ownErrorIds || []).filter((id) => id !== errorId);
        u.collectErrorIds = (u.collectErrorIds || []).filter((id) => id !== errorId);
      });
      return 'ok';
    }
  );
  if (result === 'notfound') throw { code: 400, msg: '错题不存在或已删除' };
  if (result === 'forbidden') throw { code: 403, msg: '仅本人可删除自己的错题' };
  // 同步清理磁盘图片文件
  if (removedImages && removedImages.length) removeImageFiles(removedImages);
  return { msg: '删除成功' };
}

/**
 * 将上传成功的图片 URL 持久化到错题（编辑/补充图片场景）
 * @param {object} p {userId, errorId, urls:string[]}
 * @returns {Promise<{images:string[]}>}
 */
async function addImages(p) {
  const eid = Number(p.errorId);
  if (!eid) throw { code: 400, msg: '错题ID参数错误' };
  const result = await updateJson('error.json', (data) => {
    const e = data.find((x) => x.errorId === eid);
    if (!e) return 'notfound';
    if (e.authorUserId !== p.userId) return 'forbidden';
    const cur = Array.isArray(e.images) ? e.images : [];
    const merged = cur.concat(p.urls || []).slice(0, MAX_COUNT); // 上限 5 张
    e.images = merged;
    return true;
  });
  if (result === 'notfound') throw { code: 400, msg: '错题不存在' };
  if (result === 'forbidden') throw { code: 403, msg: '仅本人可上传本题图片' };
  return { images: p.urls || [] };
}

/**
 * 点赞 / 取消点赞（单用户对单条错题仅 1 次，重复返回 409）
 * @param {object} p {userId, errorId}
 */
async function toggleLike(p) {
  const errorId = Number(p.errorId);
  const errors = await readJson('error.json');
  const error = errors.find((x) => x.errorId === errorId);
  if (!error) throw { code: 400, msg: '错题不存在' };
  const authorId = error.authorUserId;

  // 事务：点赞表 + 用户积分表，原子切换点赞状态
  const result = await updateMulti(['like.json', 'user.json'], async (datas) => {
    const likes = datas['like.json'];
    const idx = likes.findIndex((l) => l.errorId === errorId && l.userId === p.userId);
    if (idx > -1) {
      // 已点赞 → 取消点赞，作者积分 -1
      likes.splice(idx, 1);
      const author = datas['user.json'].find((u) => u.userId === authorId);
      if (author) author.score = Math.max(0, (author.score || 0) - 1);
      return { liked: false };
    }
    // 未点赞 → 新增点赞（分配自增 ID），作者积分 +1
    const likeId = await nextId('like');
    likes.push({ likeId, errorId, userId: p.userId, createTime: Date.now() });
    const author = datas['user.json'].find((u) => u.userId === authorId);
    if (author) author.score = (author.score || 0) + 1;
    return { liked: true };
  });

  const ctx = await buildStatsContext();
  return { liked: result.liked, likeCount: ctx.likeCount[errorId] || 0 };
}

/**
 * 收藏 / 取消收藏（逻辑同点赞）
 * @param {object} p {userId, errorId}
 */
async function toggleCollect(p) {
  const errorId = Number(p.errorId);
  const errors = await readJson('error.json');
  if (!errors.find((x) => x.errorId === errorId)) throw { code: 400, msg: '错题不存在' };

  let collected;
  const existing = await updateJson('collect.json', (data) => {
    const idx = data.findIndex((c) => c.errorId === errorId && c.userId === p.userId);
    if (idx > -1) { data.splice(idx, 1); return false; }
    return true;
  });
  if (existing === false) {
    collected = false;
  } else {
    const collectId = await nextId('collect');
    await updateJson('collect.json', (data) => {
      data.push({ collectId, errorId, userId: p.userId, createTime: Date.now() });
    });
    collected = true;
  }
  const ctx = await buildStatsContext();
  return { collected, collectCount: ctx.collectCount[errorId] || 0 };
}

/**
 * 公开错题列表（首页）：年级 / 学科筛选 + 关键词（题目/类型/年级/学科）搜索 + 分页
 * @param {object} q {grade, subject, keyword, type, page, userId}
 */
async function listPublic(q) {
  // 年级筛选校验（边界场景 13）
  if (q.grade && q.grade !== 'all' && q.grade !== '') {
    const g = V.validateGrade(q.grade);
    if (!g.ok) throw { code: 400, msg: g.msg };
  }
  if (q.type && q.type !== 'all' && q.type !== '') {
    const t = V.validateType(q.type);
    if (!t.ok) throw { code: 400, msg: t.msg };
  }
  if (q.subject && q.subject !== 'all' && q.subject !== '') {
    const s = V.validateSubject(q.subject);
    if (!s.ok) throw { code: 400, msg: s.msg };
  }
  const ctx = await buildStatsContext();
  const kw = (q.keyword || '').trim().toLowerCase();
  let list = ctx.errors.filter((e) => e.isPublic === true);
  if (q.grade && q.grade !== 'all' && q.grade !== '') list = list.filter((e) => e.grade === q.grade);
  if (q.subject && q.subject !== 'all' && q.subject !== '') list = list.filter((e) => e.subject === q.subject);
  if (q.type && q.type !== 'all' && q.type !== '') list = list.filter((e) => e.type === q.type);
  if (kw) {
    list = list.filter(
      (e) =>
        (e.title || '').toLowerCase().includes(kw) ||
        (e.type || '').toLowerCase().includes(kw) ||
        (e.grade || '').toLowerCase().includes(kw) ||
        (e.subject || '').toLowerCase().includes(kw)
    );
  }
  // 按创建时间倒序
  list.sort((a, b) => b.createTime - a.createTime);
  const pageData = paginate(list, q.page);
  pageData.list = pageData.list.map((e) => enrich(e, ctx, q.userId));
  return pageData;
}

/**
 * 我的错题列表：按 ownErrorIds / 作者过滤 + 年级 / 学科筛选 + 公开/私有筛选 + 分页
 * @param {object} q {userId, grade, subject, scope('all'|'public'|'private'), page}
 */
async function listMine(q) {
  if (q.grade && q.grade !== 'all' && q.grade !== '') {
    const g = V.validateGrade(q.grade);
    if (!g.ok) throw { code: 400, msg: g.msg };
  }
  if (q.subject && q.subject !== 'all' && q.subject !== '') {
    const s = V.validateSubject(q.subject);
    if (!s.ok) throw { code: 400, msg: s.msg };
  }
  const ctx = await buildStatsContext();
  let list = ctx.errors.filter((e) => e.authorUserId === q.userId);
  if (q.grade && q.grade !== 'all' && q.grade !== '') list = list.filter((e) => e.grade === q.grade);
  if (q.subject && q.subject !== 'all' && q.subject !== '') list = list.filter((e) => e.subject === q.subject);
  if (q.scope === 'public') list = list.filter((e) => e.isPublic === true);
  if (q.scope === 'private') list = list.filter((e) => e.isPublic !== true);
  list.sort((a, b) => b.createTime - a.createTime);
  const pageData = paginate(list, q.page);
  pageData.list = pageData.list.map((e) => enrich(e, ctx, q.userId));
  return pageData;
}

/**
 * 错题详情：私有题非作者不可见
 * @param {object} q {userId(可空), errorId}
 */
async function getDetail(q) {
  const errorId = Number(q.errorId);
  const ctx = await buildStatsContext();
  const e = ctx.errors.find((x) => x.errorId === errorId);
  if (!e) throw { code: 400, msg: '错题不存在或已删除' };
  if (e.isPublic !== true && q.userId !== e.authorUserId) {
    throw { code: 403, msg: '无权查看该私有错题' };
  }
  const data = enrich(e, ctx, q.userId);
  data.isOwner = q.userId === e.authorUserId;
  data.createTimeText = new Date(e.createTime).toLocaleString('zh-CN');
  return { error: data };
}

/**
 * 错题排行榜：按点赞总数降序 + 年级 / 学科筛选 + 分页
 * @param {object} q {grade, subject, page}
 */
async function getRank(q) {
  if (q.grade && q.grade !== 'all' && q.grade !== '') {
    const g = V.validateGrade(q.grade);
    if (!g.ok) throw { code: 400, msg: g.msg };
  }
  if (q.subject && q.subject !== 'all' && q.subject !== '') {
    const s = V.validateSubject(q.subject);
    if (!s.ok) throw { code: 400, msg: s.msg };
  }
  const ctx = await buildStatsContext();
  let list = ctx.errors.slice();
  if (q.grade && q.grade !== 'all' && q.grade !== '') list = list.filter((e) => e.grade === q.grade);
  if (q.subject && q.subject !== 'all' && q.subject !== '') list = list.filter((e) => e.subject === q.subject);

  // 计算点赞数并排序
  list = list.map((e) => ({ ...e, likeCount: ctx.likeCount[e.errorId] || 0 }));
  list.sort((a, b) => b.likeCount - a.likeCount || a.errorId - b.errorId);

  const pageData = paginate(list, q.page);
  // 计算全局排名序号（跨页连续）
  const startRank = (pageData.page - 1) * PAGE_SIZE;
  pageData.list = pageData.list.map((e, i) => ({
    ...e,
    rank: startRank + i + 1,
    authorNickname: ctx.userMap[e.authorUserId] || '匿名',
  }));
  return pageData;
}

/**
 * 个人错题分析报告：按错误类型 / 年级 / 学科聚合计数，并生成复习建议
 * @param {object} p {userId}
 * @returns {object} { total, byType, byGrade, bySubject, suggestions }
 */
async function report(p) {
  // 读取用户与错题表（仅本用户 ownErrorIds 内的错题计入分析）
  const [users, errors] = await Promise.all([
    readJson('user.json'),
    readJson('error.json'),
  ]);
  const u = users.find((x) => x.userId === p.userId);
  if (!u) throw { code: 401, msg: '未登录或会话已失效' };

  const ownIds = new Set(u.ownErrorIds || []);
  const own = errors.filter((e) => ownIds.has(e.errorId));

  // 按错误类型聚合
  const typeMap = {};
  // 按年级聚合
  const gradeMap = {};
  // 按学科聚合
  const subjectMap = {};
  own.forEach((e) => {
    typeMap[e.type] = (typeMap[e.type] || 0) + 1;
    gradeMap[e.grade] = (gradeMap[e.grade] || 0) + 1;
    subjectMap[e.subject || '其他'] = (subjectMap[e.subject || '其他'] || 0) + 1;
  });

  // 转为排序数组（降序，便于前端绘图与重点提示）
  const byType = Object.keys(typeMap)
    .map((k) => ({ name: k, count: typeMap[k] }))
    .sort((a, b) => b.count - a.count);
  const byGrade = Object.keys(gradeMap)
    .map((k) => ({ name: k, count: gradeMap[k] }))
    .sort((a, b) => b.count - a.count);
  const bySubject = Object.keys(subjectMap)
    .map((k) => ({ name: k, count: subjectMap[k] }))
    .sort((a, b) => b.count - a.count);

  // 生成复习建议
  const suggestions = buildSuggestions(byType, own.length);
  return { total: own.length, byType, byGrade, bySubject, suggestions };
}

// 错误类型 → 针对性复习建议文案（单一来源，与后端枚举保持一致）
const TYPE_TIPS = {
  计算失误: '加强基础计算训练：养成"做完反向代入检验"的习惯，避免抄错数字或正负号。',
  概念混淆: '梳理知识框架：区分易混概念的定义与适用场景，建立对比笔记，做题先判断考点。',
  审题错误: '训练圈画关键词的审题习惯：放慢读题速度，明确"求什么、给什么、限制条件是什么"。',
  记忆遗漏: '用间隔重复强化记忆（错题卡片 / 艾宾浩斯法），归纳高频考点形成记忆清单。',
  其他: '结合解析复盘具体错因，建立个人错因档案，定期回看同类题型。',
};

/**
 * 根据类型分布生成复习建议
 * @returns {object} { summary, list:[{name,count,percent,tip}] }
 */
function buildSuggestions(byType, total) {
  if (!total) {
    return {
      summary: '你还没有录入任何错题，先去"新增错题"积累数据，系统才能生成分析报告。',
      list: [],
    };
  }
  const top = byType[0];
  const topPct = Math.round((top.count / total) * 100);
  const list = byType.map((t) => ({
    name: t.name,
    count: t.count,
    percent: Math.round((t.count / total) * 100),
    tip: TYPE_TIPS[t.name] || TYPE_TIPS['其他'],
  }));
  const summary = `你共有 ${total} 道错题，最主要问题集中在「${top.name}」(${top.count} 道，占 ${topPct}%)，建议优先突破该类型。`;
  return { summary, list };
}

/**
 * 计算单条错题的复习计划元数据（用于前端展示与排序）
 * @param {object} error 错题对象（含 createTime、reviewedStages）
 * @param {number} todayDate 当天 0 点毫秒值
 */
function reviewMeta(error, todayDate) {
  const reviewed = Array.isArray(error.reviewedStages) ? error.reviewedStages.slice() : [];
  const dueStages = []; // 已到/已过计划日且尚未复习的阶段下标
  let nextStage = null; // 下一个未复习阶段
  let nextReviewDate = null; // 下一个阶段的计划日期
  let firstDueDate = null; // 最早一个待复习阶段的计划日期（用于排序/展示）
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const sd = scheduledDate(error, i);
    if (!reviewed.includes(i)) {
      if (nextStage === null) { nextStage = i; nextReviewDate = sd; }
      if (todayDate >= sd) {
        dueStages.push(i);
        if (firstDueDate === null) firstDueDate = sd;
      }
    }
  }
  return {
    totalStages: TOTAL_STAGES,
    reviewedCount: reviewed.length,
    dueStages,
    dueCount: dueStages.length,
    nextStage,
    nextReviewDate,
    firstDueDate,
    // 距提交已过去的天数（含今日）
    elapsedDays: Math.floor((todayDate - startOfDay(error.createTime)) / DAY),
    // 最早待复习阶段已逾期天数（未逾期则为 0）
    overdueDays: firstDueDate !== null ? Math.max(0, Math.floor((todayDate - firstDueDate) / DAY)) : 0,
    allDone: reviewed.length >= TOTAL_STAGES,
    createTime: error.createTime,
  };
}

/**
 * 获取「当日待复习」错题列表（仅本人，按最早待复习日升序）
 * @param {object} p {userId, today?}
 * @returns {object} { summary:{dueCount,totalDueStages}, list:[...] }
 */
async function getReviewList(p) {
  const todayDate = startOfDay(p.today || Date.now());
  const ctx = await buildStatsContext();
  const enriched = ctx.errors
    .filter((e) => e.authorUserId === p.userId)
    .map((e) => ({ error: e, meta: reviewMeta(e, todayDate) }))
    .filter((x) => x.meta.dueCount > 0) // 仅保留有计划日内需复习的
    .sort((a, b) => (a.meta.firstDueDate || 0) - (b.meta.firstDueDate || 0)); // 最逾期未复习的排前

  const list = enriched.map(({ error, meta }) => ({
    errorId: error.errorId,
    title: error.title,
    subject: error.subject || '其他',
    type: error.type,
    grade: error.grade,
    answer: error.answer,
    analysis: error.analysis,
    images: error.images || [],
    createTime: error.createTime,
    ...meta,
  }));

  return {
    summary: {
      dueCount: list.length,
      totalDueStages: list.reduce((s, x) => s + x.dueCount, 0),
    },
    list,
  };
}

/**
 * 标记某错题「今日已复习」：将当前所有已到计划日且未复习的阶段标记为完成
 * @param {object} p {userId, errorId, today?}
 */
async function markReviewed(p) {
  const errorId = Number(p.errorId);
  if (!errorId) throw { code: 400, msg: '错题ID参数错误' };
  const todayDate = startOfDay(p.today || Date.now());
  let marked = 0;

  const result = await updateJson('error.json', (data) => {
    const e = data.find((x) => x.errorId === errorId);
    if (!e) return 'notfound';
    if (e.authorUserId !== p.userId) return 'forbidden';
    const reviewed = Array.isArray(e.reviewedStages) ? e.reviewedStages.slice() : [];
    marked = 0;
    for (let i = 0; i < TOTAL_STAGES; i++) {
      if (!reviewed.includes(i) && todayDate >= scheduledDate(e, i)) {
        reviewed.push(i);
        marked++;
      }
    }
    if (marked === 0) return 'noupdate'; // 当前无到期阶段可标记（重复提交或尚未到复习日）
    e.reviewedStages = reviewed;
    e.lastReviewTime = Date.now();
    return true;
  });

  if (result === 'notfound') throw { code: 400, msg: '错题不存在或已删除' };
  if (result === 'forbidden') throw { code: 403, msg: '仅本人可复习自己的错题' };
  if (result === 'noupdate') throw { code: 409, msg: '该题当前没有待复习的阶段' };

  const errors = await readJson('error.json');
  const e = errors.find((x) => x.errorId === errorId);
  return { meta: reviewMeta(e, todayDate), marked };
}

module.exports = {
  PAGE_SIZE,
  REVIEW_STAGES,
  addError,
  updateError,
  deleteError,
  toggleLike,
  toggleCollect,
  listPublic,
  listMine,
  getDetail,
  getRank,
  report,
  addImages,
  getReviewList,
  markReviewed,
};
