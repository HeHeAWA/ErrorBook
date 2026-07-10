/**
 * multipart.js —— 原生 multipart/form-data 解析器（零第三方依赖）
 * 功能：将浏览器提交的 FormData（multipart/form-data; boundary=xxx）二进制报文解析为
 *       { fields: {name: value}, files: [{ name, filename, contentType, buffer }] }。
 * 说明：
 *   - 全程按 Buffer 处理，避免二进制被当字符串截断/乱码；
 *   - 仅依赖 Node 内置 Buffer.indexOf，无外部库；
 *   - 解析失败统一抛出 { code, msg }，由调用方捕获。
 * 依赖：无
 */

/**
 * 在 haystack 中从 from 开始查找 needle（Buffer）位置
 * @param {Buffer} haystack
 * @param {Buffer} needle
 * @param {number} from
 * @returns {number} 索引，找不到返回 -1
 */
function indexOf(haystack, needle, from) {
  return haystack.indexOf(needle, from);
}

/**
 * 解析 multipart 报文
 * @param {Buffer} buffer 完整请求体（二进制）
 * @param {string} contentType 请求头 Content-Type（含 boundary）
 * @returns {{fields: object, files: Array}} 解析结果
 * @throws {object} {code:400,msg} 格式非法
 */
function parse(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw { code: 400, msg: '上传数据为空' };
  }
  // 1. 提取 boundary
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw { code: 400, msg: 'multipart 格式非法：缺少 boundary' };
  const boundary = (m[1] || m[2]).trim();
  if (!boundary) throw { code: 400, msg: 'multipart 格式非法：boundary 为空' };
  const bBuf = Buffer.from('--' + boundary);

  const fields = {};
  const files = [];
  const CRLF = Buffer.from('\r\n');
  const CRLFCRLF = Buffer.from('\r\n\r\n');

  let pos = indexOf(buffer, bBuf, 0);
  if (pos === -1) throw { code: 400, msg: 'multipart 格式非法：未发现 boundary' };

  while (pos !== -1) {
    let start = pos + bBuf.length;
    // 若为结尾 boundary（--boundary--），则结束
    if (buffer[start] === 0x2d && buffer[start + 1] === 0x2d) break;
    // 跳过 boundary 后的 CRLF
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;

    // 定位下一个 boundary，作为本段结束
    const next = indexOf(buffer, bBuf, start);
    const end = next === -1 ? buffer.length : next;
    let seg = buffer.slice(start, end);
    // 去掉段尾 CRLF（内容与其后 boundary 之间的换行）
    if (seg.length >= 2 && seg[seg.length - 2] === 0x0d && seg[seg.length - 1] === 0x0a) {
      seg = seg.slice(0, seg.length - 2);
    }

    // 头部与正文以 CRLFCRLF 分隔
    const headerEnd = indexOf(seg, CRLFCRLF, 0);
    if (headerEnd === -1) { pos = next; continue; }
    const headerStr = seg.slice(0, headerEnd).toString('utf8');
    const content = seg.slice(headerEnd + 4);

    // 解析 Content-Disposition 与 Content-Type
    const disp = /Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i.exec(headerStr);
    const ctypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerStr);
    if (!disp) { pos = next; continue; }
    const name = disp[1];
    const filename = disp[2];
    const contentType = ctypeMatch ? ctypeMatch[1].trim() : '';

    if (filename) {
      // 文件域
      files.push({ name, filename, contentType, buffer: content });
    } else {
      // 普通文本域
      fields[name] = content.toString('utf8');
    }
    pos = next;
  }

  return { fields, files };
}

module.exports = { parse };
