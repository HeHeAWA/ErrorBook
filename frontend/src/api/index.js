/**
 * api/index.js —— 统一封装后端 REST 请求
 * 约定：携带 credentials 以发送会话 Cookie；返回结构统一为 { code, msg, data }。
 */
async function _req(url, method, body) {
  const opt = {
    method: method || 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opt.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opt);
    return await res.json();
  } catch (e) {
    return { code: 500, msg: '网络错误或服务未启动', data: {} };
  }
}

function qs(params) {
  if (!params) return '';
  const arr = [];
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '')
      arr.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
  });
  return arr.length ? '?' + arr.join('&') : '';
}

export const api = {
  // ---------- 用户 ----------
  register: (p) => _req('/api/user/register', 'POST', p),
  login: (p) => _req('/api/user/login', 'POST', p),
  logout: () => _req('/api/user/logout', 'POST', {}),
  updateUser: (p) => _req('/api/user/update', 'POST', p),
  getUserInfo: () => _req('/api/user/info', 'GET'),

  // ---------- 错题 ----------
  addError: (p) => _req('/api/error/add', 'POST', p),
  updateError: (p) => _req('/api/error/update', 'POST', p),
  deleteError: (p) => _req('/api/error/delete', 'POST', p),
  toggleLike: (errorId) => _req('/api/error/like', 'POST', { errorId }),
  toggleCollect: (errorId) => _req('/api/error/collect', 'POST', { errorId }),
  getErrorList: (params) => _req('/api/error/list' + qs(params), 'GET'),
  getMyErrors: (params) => _req('/api/error/my' + qs(params), 'GET'),
  getErrorDetail: (errorId) => _req('/api/error/detail' + qs({ errorId }), 'GET'),
  getRank: (params) => _req('/api/error/rank' + qs(params), 'GET'),
  getReport: () => _req('/api/error/report', 'GET'),

  // ---------- 艾宾浩斯定时复习 ----------
  getReviewList: () => _req('/api/error/review', 'GET'),
  markReviewed: (errorId) => _req('/api/error/review/mark', 'POST', { errorId }),

  // ---------- 图片上传（multipart/form-data，不走 JSON） ----------
  uploadErrorImages: (formData) =>
    fetch('/api/error/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    })
      .then((res) => res.json())
      .catch(() => ({ code: 500, msg: '网络错误或服务未启动', data: {} })),
};

export default api;
