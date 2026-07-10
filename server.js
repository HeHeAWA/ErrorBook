/**
 * server.js —— Node 服务入口
 * 功能：
 *   1. 启动钩子：初始化数据文件、清理过期 Session、修复自增 ID；
 *   2. 仅内置模块（http/fs/path/url/querystring），无第三方依赖；
 *   3. 静态页面托管 + 受保护页面鉴权拦截（未登录跳转登录页）；
 *   4. REST 接口路由 + 统一返回结构 {code,msg,data}；
 *   5. 跨域仅允许 localhost；全局异常捕获并写入日志。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const { initAllDataFiles, logError, ROOT } = require('./tools/fileOpt');
const { ensureAuth, cleanExpiredSessions } = require('./middleware/auth');
const { parse: parseMultipart } = require('./tools/multipart');
const imageService = require('./service/imageService');
const cross = require('./middleware/cross');
const userRoute = require('./route/userRoute');
const errorRoute = require('./route/errorRoute');
const { GRADE_ENUM, TYPE_ENUM, SUBJECT_ENUM } = require('./middleware/validator');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(ROOT, 'public');

// MIME 映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// 接口路由表（path 精确匹配；auth=true 表示需登录）
const ROUTES = [
  { method: 'POST', path: '/api/user/register', auth: false, fn: userRoute.register },
  { method: 'POST', path: '/api/user/login', auth: false, fn: userRoute.login },
  { method: 'POST', path: '/api/user/logout', auth: true, fn: userRoute.logout },
  { method: 'POST', path: '/api/user/update', auth: true, fn: userRoute.update },
  { method: 'GET', path: '/api/user/info', auth: true, fn: userRoute.info },
  { method: 'POST', path: '/api/error/add', auth: true, fn: errorRoute.add },
  { method: 'POST', path: '/api/error/update', auth: true, fn: errorRoute.update },
  { method: 'POST', path: '/api/error/delete', auth: true, fn: errorRoute.del },
  { method: 'POST', path: '/api/error/like', auth: true, fn: errorRoute.like },
  { method: 'POST', path: '/api/error/collect', auth: true, fn: errorRoute.collect },
  { method: 'GET', path: '/api/error/list', auth: false, fn: errorRoute.list },
  { method: 'GET', path: '/api/error/my', auth: true, fn: errorRoute.my },
  { method: 'GET', path: '/api/error/detail', auth: false, fn: errorRoute.detail },
  { method: 'GET', path: '/api/error/rank', auth: false, fn: errorRoute.rank },
  { method: 'GET', path: '/api/error/report', auth: true, fn: errorRoute.report },
  { method: 'GET', path: '/api/error/review', auth: true, fn: errorRoute.reviewList },
  { method: 'POST', path: '/api/error/review/mark', auth: true, fn: errorRoute.reviewMark },
  { method: 'POST', path: '/api/error/upload', auth: true, fn: errorRoute.upload },
  { method: 'GET', path: '/api/meta', auth: false, fn: metaHandler },
];

/** /api/meta：返回年级 / 类型 / 学科枚举（供前端下拉使用） */
async function metaHandler() {
  return { code: 200, msg: 'ok', data: { grades: GRADE_ENUM, types: TYPE_ENUM, subjects: SUBJECT_ENUM } };
}

/** 统一 JSON 响应（HTTP 状态码与业务 code 一致，便于前端判断） */
function sendJson(res, payload) {
  const code = payload.code || 500;
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/** 读取请求体（POST），上限 1MB，解析失败回退 querystring */
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) { tooBig = true; req.destroy(); } // 超过 1MB 直接断开
    });
    req.on('end', () => {
      if (tooBig) return resolve({});
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        try { resolve(querystring.parse(data)); } catch (_) { resolve({}); }
      }
    });
  });
}

/** multipart 上传体读取上限（5 张 × 2MB + 余量） */
const MULTIPART_LIMIT = 12 * 1024 * 1024; // 12MB

/**
 * 以 Buffer 读取 multipart/form-data 请求体并解析
 * @param {http.IncomingMessage} req
 * @param {string} contentType
 * @returns {Promise<{fields:object, files:Array}>}
 * @throws {object} {code,msg} 超限 / 解析失败
 */
function readMultipart(req, contentType) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MULTIPART_LIMIT) {
        req.destroy();
        reject({ code: 400, msg: '上传文件过大（上限 12MB）' });
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        resolve(parseMultipart(buf, contentType));
      } catch (e) {
        reject(e && e.code ? e : { code: 400, msg: '上传数据解析失败' });
      }
    });
    req.on('error', () => reject({ code: 500, msg: '读取上传数据失败' }));
  });
}

/** 发送 SPA 入口（public/dist/index.html） */
function sendIndex(res) {
  const index = path.join(PUBLIC_DIR, 'dist', 'index.html');
  fs.readFile(index, (err, buf) => {
    if (err) {
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME['.html']);
      res.end(
        '<h1>前端尚未构建</h1><p>请先进入 frontend 目录执行 <code>npm install &amp;&amp; npm run build</code>。</p>'
      );
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME['.html']);
    res.end(buf);
  });
}

/** 静态文件服务（含目录穿越防护 + SPA 回退） */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  // 根路径 / 旧入口统一返回 SPA 入口
  if (rel === '/' || rel === '/index.html' || rel === '') {
    return sendIndex(res);
  }
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  // 目录穿越防护
  if (!full.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.stat(full, (err, stat) => {
    if (!err && stat.isFile()) {
      return sendFile(full, res);
    }
    // 构建产物资源（/assets/*）位于 public/dist 下
    if (rel.startsWith('/assets/')) {
      const inDist = path.normalize(path.join(PUBLIC_DIR, 'dist', rel));
      if (inDist.startsWith(PUBLIC_DIR)) {
        return fs.stat(inDist, (e2, s2) => {
          if (!e2 && s2.isFile()) return sendFile(inDist, res);
          notFound(res);
        });
      }
    }
    // 无扩展名的客户端路由 → 回退到 SPA 入口（由前端路由处理）
    if (!path.extname(rel)) {
      return sendIndex(res);
    }
    notFound(res);
  });
}

function sendFile(file, res) {
  const ext = path.extname(file).toLowerCase();
  fs.readFile(file, (e, buf) => {
    if (e) return notFound(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(buf);
  });
}

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', MIME['.html']);
  res.end('<h1>404 页面不存在</h1>');
}

/** 主请求处理 */
async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // 预检
  if (cross.handleOptions(req, res)) return;

  // 接口请求
  if (pathname.startsWith('/api/')) {
    if (!cross.applyCors(req, res)) return; // 非法跨域已拦截
    const route = ROUTES.find((r) => r.method === req.method && r.path === pathname);
    if (!route) {
      sendJson(res, { code: 404, msg: '接口不存在', data: {} });
      return;
    }
    // 鉴权：需登录接口强制校验；公开接口做「可选鉴权」——
    // 有会话则注入 userId（便于本人查看自己的私密错题 / 标记归属），无会话则为 null（私密题仍对他人隐藏）。
    let userId = null;
    if (route.auth) {
      userId = await ensureAuth(req);
      if (!userId) {
        sendJson(res, { code: 401, msg: '未登录或会话已过期', data: {} });
        return;
      }
    } else {
      userId = await ensureAuth(req); // 不强制，仅在有合法会话时回填 userId
    }
    const ctx = { query: parsed.query, userId };
    try {
      if (req.method === 'POST') {
        // 图片上传为 multipart，其余为 JSON
        const isMultipart = /multipart\/form-data/i.test(req.headers['content-type'] || '');
        if (isMultipart) ctx.multipart = await readMultipart(req, req.headers['content-type']);
        else ctx.body = await readBody(req);
      }
      const result = await route.fn(req, res, ctx);
      sendJson(res, result);
    } catch (err) {
      // 业务异常（含 {code,msg}）统一捕获
      const code = err && err.code ? err.code : 500;
      const msg = err && err.msg ? err.msg : '服务器异常';
      logError(`接口 ${req.method} ${pathname} 异常: ${msg} | ${err && err.stack ? err.stack : ''}`);
      sendJson(res, { code, msg, data: (err && err.data) || {} });
    }
    return;
  }

  // 静态资源 / SPA 入口
  serveStatic(req, res, pathname);
}

/** 启动 */
async function start() {
  try {
    initAllDataFiles(); // 启动钩子①：缺失文件自动生成模板
    imageService.ensureUploadDir(); // 启动钩子④：确保图片上传目录存在
    await cleanExpiredSessions(); // 启动钩子②：清理过期 Session
    await require('./tools/idGenerator').repairAutoId(); // 启动钩子③：修复自增 ID
  } catch (e) {
    logError('启动初始化失败: ' + (e && e.stack ? e.stack : e));
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      logError('未捕获异常: ' + (e && e.stack ? e.stack : e));
      if (!res.headersSent) sendJson(res, { code: 500, msg: '服务器异常', data: {} });
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`✅ 错题集管理系统已启动`);
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   仅允许 localhost 访问，数据存于 /data 目录`);
  });
}

start();
