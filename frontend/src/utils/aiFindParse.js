/**
 * utils/aiFindParse.js —— 识别错题的纯解析函数（环境无关）
 * 仅做文本规则解析，不依赖 DOM / OCR 引擎 / 网络。
 * 设计目标：对「不那么完美」的 OCR 结果也能尽量提取出正确的题号与批改状态。
 */

const CN_NUM = '一二三四五六七八九十百';

/** 将「第X题」拆分为独立行，便于按题号分块 */
function normalize(text) {
  return (text || '').replace(/第\s*(\d+|[一二三四五六七八九十百]+)\s*题/g, '\n第$1题');
}

/** 判断某行是否开启一道新题（行首题号） */
function isQuestionStart(line) {
  return (
    /^\s*\d{1,3}[.、)）．]/.test(line) ||
    /^\s*[一二三四五六七八九十百]+[.、)）．]/.test(line) ||
    /^\s*第\s*\d+\s*题/.test(line) ||
    /^\s*第\s*[一二三四五六七八九十百]+\s*题/.test(line) ||
    /^\s*[（(]\s*\d{1,3}\s*[)）]/.test(line) ||
    /^\s*[（(]\s*[一二三四五六七八九十百]+\s*[)）]/.test(line) ||
    /^\s*[lI][.、)）．]/.test(line) ||
    /^\s*[oO][.、)）．]/.test(line)
  );
}

/** 从一行中提取题号字符串（含 OCR 字母误识别的容错） */
function extractNumber(line) {
  let m = /^\s*(\d{1,3})[.、)）．]/.exec(line);
  if (m) return m[1];
  m = /^\s*([一二三四五六七八九十百]+)[.、)）．]/.exec(line);
  if (m) return m[1];
  m = /^\s*第\s*(\d+|[一二三四五六七八九十百]+)\s*题/.exec(line);
  if (m) return m[1];
  m = /^\s*[（(]\s*(\d{1,3})\s*[)）]/.exec(line);
  if (m) return m[1];
  m = /^\s*[（(]\s*([一二三四五六七八九十百]+)\s*[)）]/.exec(line);
  if (m) return m[1];
  m = /^\s*([lI])[.、)）．]/.exec(line);
  if (m) return '1';
  m = /^\s*([oO])[.、)）．]/.exec(line);
  if (m) return '0';
  return null;
}

/** 在题目正文内部补全题号 */
function recoverNumber(body) {
  let m = /第\s*(\d+|[一二三四五六七八九十百]+)\s*题/.exec(body);
  if (m) return m[1];
  m = /\(\s*\d{1,3}\s*\)|（\s*\d{1,3}\s*）/.exec(body);
  if (m) {
    const n = m[0].replace(/[（()\s]/g, '');
    if (n) return n;
  }
  return null;
}

/** 检测一段文字中的批改信号 */
function detectSignals(block) {
  const t = block || '';
  const sig = { wrongSym: false, wrongWord: false, deduction: false, correctMark: false, score: null };
  if (/[✗×]/.test(t)) sig.wrongSym = true;
  if (/错|误|不正确|不对|错的/.test(t)) sig.wrongWord = true;
  if (/扣分|扣\s*\d+\s*分?|减\s*\d+\s*分|失\s*\d+\s*分|[-−]\s*\d+\s*分|罚分|少给/.test(t)) sig.deduction = true;
  if (/[✓√]|全对|正确|对|OK|好/.test(t)) sig.correctMark = true;
  const m = /得分[：:]\s*(\d+(?:\.\d+)?)/.exec(t) || /(\d+(?:\.\d+)?)\s*分/.exec(t) || /(\d+)\s*\/\s*(\d+)/.exec(t);
  if (m) sig.score = m[1] !== undefined ? parseFloat(m[1]) : null;
  return sig;
}

/** 合并信号为状态：wrong > correct > unknown */
function signalsToStatus(sig) {
  if (sig.wrongSym || sig.wrongWord || sig.deduction) return 'wrong';
  if (sig.correctMark) return 'correct';
  return 'unknown';
}

function reasonText(sig) {
  const arr = [];
  if (sig.wrongSym) arr.push('错误符号(×/✗)');
  if (sig.wrongWord) arr.push('含「错/误」字样');
  if (sig.deduction) arr.push('扣分标记');
  if (sig.correctMark) arr.push('正确标记(√/对)');
  return arr.length ? arr.join('；') : '未识别到明确标记，请人工确认';
}

/** 解析整段文字 → 题目数组（已去重、按题号排序） */
function parsePaper(text) {
  const norm = normalize(text);
  const lines = norm.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (isQuestionStart(line)) {
      cur = { number: extractNumber(line), body: line + '\n' };
      blocks.push(cur);
    } else if (cur) {
      cur.body += line + '\n';
    } else {
      if (!blocks.length) {
        cur = { number: null, body: line + '\n' };
        blocks.push(cur);
      } else blocks[0].body += line + '\n';
    }
  }

  blocks.forEach((b) => {
    if (b.number == null) {
      const rn = recoverNumber(b.body);
      if (rn != null) b.number = rn;
    }
  });

  const hasNumbered = blocks.some((b) => b.number != null);
  const kept = blocks.filter((b) => {
    if (b.number != null) return true;
    if (!hasNumbered) return true;
    const sig = detectSignals(b.body);
    return sig.wrongSym || sig.wrongWord || sig.deduction || sig.correctMark;
  });

  const map = new Map();
  kept.forEach((b) => {
    const num = b.number || '未编号';
    const sig = detectSignals(b.body);
    if (!map.has(num)) {
      map.set(num, { number: num, signals: [sig], score: sig.score });
    } else {
      const e = map.get(num);
      e.signals.push(sig);
      if (sig.score !== null && e.score === null) e.score = sig.score;
    }
  });

  const questions = [];
  let wrongCount = 0;
  for (const [num, e] of map) {
    let anyWrong = false,
      anyCorrect = false;
    e.signals.forEach((s) => {
      const st = signalsToStatus(s);
      if (st === 'wrong') anyWrong = true;
      if (st === 'correct') anyCorrect = true;
    });
    const merged = anyWrong ? 'wrong' : anyCorrect ? 'correct' : 'unknown';
    const allSig = e.signals.reduce((acc, s) => {
      const r = reasonText(s);
      if (!acc.includes(r)) acc.push(r);
      return acc;
    }, []);
    if (merged === 'wrong') wrongCount += 1;
    questions.push({ number: num, status: merged, score: e.score, reason: allSig.join('；') });
  }
  questions.sort((a, b) => {
    const na = parseFloat(a.number),
      nb = parseFloat(b.number);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.number.localeCompare(b.number, 'zh');
  });
  return { questions, wrongCount };
}

export { normalize, isQuestionStart, extractNumber, recoverNumber, detectSignals, signalsToStatus, reasonText, parsePaper };
export default { normalize, isQuestionStart, extractNumber, recoverNumber, detectSignals, signalsToStatus, reasonText, parsePaper };
