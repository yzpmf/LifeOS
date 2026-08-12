// ============================================================
//  Life OS — 工具函数
// ============================================================

const DAY_MS = 86400000;

/** 生成短随机 ID */
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Date → 本地时区的 YYYY-MM-DD（不能用 toISOString，它转 UTC 会差一天） */
export function fmtYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 本地时区零点的 Date（new Date('YYYY-MM-DD') 会按 UTC 解析） */
export function parseYMD(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 取当天 00:00:00 */
export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 计算 DDL 距今天还剩几天（负数=已逾期，null=无DDL） */
export function daysLeft(ddl) {
  if (!ddl) return null;
  const target = typeof ddl === 'string' ? parseYMD(ddl) : ddl;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
}

/** 判断时间维度：short(短期) / long(长期) */
export function timeScope(ddl, threshold = 7) {
  const d = daysLeft(ddl);
  if (d === null) return 'long'; // 无 DDL 默认长期
  return d <= threshold ? 'short' : 'long';
}

/** 核心：根据 (时间维度 × 紧急) 计算象限 */
export function quadrantOf(task, threshold = 7) {
  const scope = timeScope(task.ddl, threshold);
  if (scope === 'short' && task.urgent) return 'Q1';
  if (scope === 'long' && task.urgent) return 'Q2';
  if (scope === 'short' && !task.urgent) return 'Q3';
  return 'Q4';
}

/** 格式化 DDL 显示文案 */
export function fmtDDL(ddl) {
  if (!ddl) return '无截止日期';
  const d = daysLeft(ddl);
  if (d < 0) return `已逾期 ${-d} 天`;
  if (d === 0) return '今天截止';
  if (d === 1) return '明天截止';
  return `剩余 ${d} 天`;
}

/** 判断是否逾期 */
export function isOverdue(ddl) {
  const d = daysLeft(ddl);
  return d !== null && d < 0;
}

/** N 天后的日期字符串 YYYY-MM-DD（本地时区） */
export function todayPlus(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtYMD(d);
}

/** 格式化日期: 6月8日 */
export function fmtDate(dateStr) {
  const d = parseYMD(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 格式化日期+时间 */
export function fmtDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 ${h}:${min}`;
}

/** 取今天的星期数字 (1=周一, 7=周日) */
export function todayWeekday() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d; // JS 的 0(周日) 转为 7
}

/** 取今天的日期字符串 YYYY-MM-DD（本地时区） */
export function todayStr() {
  return fmtYMD(new Date());
}

/** 计算连续打卡天数 */
export function calcStreak(records, habitId) {
  if (!records || !records[habitId]) return 0;
  const dates = Object.keys(records[habitId])
    .filter((d) => records[habitId][d])
    .sort()
    .reverse();
  if (dates.length === 0) return 0;

  let streak = 0;
  let checkDate = startOfDay(new Date());

  for (let i = 0; i < 365; i++) {
    const dateStr = fmtYMD(checkDate);
    if (records[habitId][dateStr]) {
      streak++;
    } else if (i > 0) {
      // 今天没打卡不算中断
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

/** 计算当前是学期的第几周（基于开学日期） */
export function getCurrentWeek(semesterStart) {
  if (!semesterStart) return null;
  const start = new Date(semesterStart);
  const now = new Date();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(start)) / DAY_MS);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

/** 判断课程在当前周是否应该显示 */
export function isCourseActiveThisWeek(course, currentWeek) {
  if (!currentWeek) return true; // 没设置学期则默认显示
  const { startWeek = 1, endWeek = 16, weekParity = 'ALL' } = course;
  if (currentWeek < startWeek || currentWeek > endWeek) return false;
  if (weekParity === 'ODD') return currentWeek % 2 === 1;
  if (weekParity === 'EVEN') return currentWeek % 2 === 0;
  return true; // ALL
}

/** 取某天所在周的周一 00:00（周一为一周开始） */
export function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = x.getDay() === 0 ? 7 : x.getDay(); // 周日=7
  x.setDate(x.getDate() - (dow - 1));
  return x;
}

/** 判断某日期字符串是否落在「本周」（与今天同一周） */
export function isSameWeek(dateStr) {
  if (!dateStr) return false;
  return startOfWeek(parseYMD(dateStr)).getTime() === startOfWeek(new Date()).getTime();
}

/** 把 HH:MM 转成分钟数（用于课程时间冲突判断） */
export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = String(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * 判断两门课程在指定周是否时间冲突
 * 条件：同一天、同一周范围，且 startA < endB && endA > startB
 * 临时课只跟临时课在精确日期比较，普通课跟普通课按星期+周次比较。
 */
export function isCourseTimeConflict(a, b, targetWeek = null) {
  // 临时课程：比较精确日期
  if (a.temporary || b.temporary) {
    if (!a.date || !b.date) return false;
    if (a.date !== b.date) return false;
  } else {
    // 普通课程：星期不同不冲突
    if (a.dayOfWeek !== b.dayOfWeek) return false;
    // 周次范围没有交集不冲突
    const aStart = a.startWeek || 1;
    const aEnd = a.endWeek || 16;
    const bStart = b.startWeek || 1;
    const bEnd = b.endWeek || 16;
    if (aEnd < bStart || bEnd < aStart) return false;
    // 单双周过滤（若指定了 targetWeek）
    if (targetWeek != null) {
      if (targetWeek < aStart || targetWeek > aEnd) return false;
      if (targetWeek < bStart || targetWeek > bEnd) return false;
      if (a.weekParity === 'ODD' && targetWeek % 2 === 0) return false;
      if (a.weekParity === 'EVEN' && targetWeek % 2 === 1) return false;
      if (b.weekParity === 'ODD' && targetWeek % 2 === 0) return false;
      if (b.weekParity === 'EVEN' && targetWeek % 2 === 1) return false;
    } else {
      // 未指定 targetWeek：只要周范围有交集且单双周不互斥即可
      const hasOdd = [a, b].some((c) => c.weekParity === 'ODD' || !c.weekParity || c.weekParity === 'ALL');
      const hasEven = [a, b].some((c) => c.weekParity === 'EVEN' || !c.weekParity || c.weekParity === 'ALL');
      // 若 A 单周、B 双周，则任何一周都不会同时出现
      if (!hasOdd || !hasEven) {
        // 两者分别为单/双，且不包含 ALL，才认为完全不冲突
        const aParity = a.weekParity || 'ALL';
        const bParity = b.weekParity || 'ALL';
        if ((aParity === 'ODD' && bParity === 'EVEN') || (aParity === 'EVEN' && bParity === 'ODD')) return false;
      }
    }
  }

  const aStartMin = timeToMinutes(a.startTime);
  const aEndMin = timeToMinutes(a.endTime);
  const bStartMin = timeToMinutes(b.startTime);
  const bEndMin = timeToMinutes(b.endTime);

  // 结束时间必须晚于开始时间才视为有效
  if (aEndMin <= aStartMin || bEndMin <= bStartMin) return false;

  return aStartMin < bEndMin && aEndMin > bStartMin;
}

/**
 * 查找与给定课程冲突的所有已有课程
 */
export function findConflictingCourses(newCourse, existingCourses, targetWeek = null) {
  return (existingCourses || [])
    .filter((c) => c.id !== newCourse.id && !c.deleted)
    .filter((c) => isCourseTimeConflict(newCourse, c, targetWeek));
}

/** 计算某日期对应学期第几周（semesterStart 为周一日期） */
export function getWeekOfDate(dateStr, semesterStart) {
  if (!dateStr || !semesterStart) return null;
  const start = startOfDay(new Date(semesterStart));
  const target = startOfDay(parseYMD(dateStr));
  const diffDays = Math.floor((target - start) / DAY_MS);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

/** 取某日期字符串的星期数字 (1=周一, 7=周日) */
export function weekdayOf(dateStr) {
  const d = parseYMD(dateStr).getDay();
  return d === 0 ? 7 : d;
}

/** 判断一节课（含临时课）在第 targetWeek 周的某个星期 d 是否要显示 */
export function isCourseOnDay(course, day, targetWeek, semesterStart) {
  if (course.temporary) {
    // 临时课：算出它指定日期对应第几周，跟 targetWeek 比对
    if (!course.date) return false;
    if (weekdayOf(course.date) !== day) return false;
    if (!semesterStart) return isSameWeek(course.date); // 没设置学期，退化为本周判断
    const courseWeek = getWeekOfDate(course.date, semesterStart);
    return courseWeek === targetWeek;
  }
  return course.dayOfWeek === day && isCourseActiveThisWeek(course, targetWeek);
}

/** 数字转中文（1~99，仿「一五/十四五」命名） */
const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function numToChinese(n) {
  if (n <= 0) return '零';
  if (n < 10) return CN_DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + CN_DIGITS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return CN_DIGITS[tens] + '十' + (ones ? CN_DIGITS[ones] : '');
}

/** 某天所在周的「周一」日期字符串，用作七计划的唯一 key */
export function mondayKey(date) {
  return fmtYMD(startOfWeek(date));
}

/** 七计划序号：从锚点周（首次使用那周）连续计数，1 起 */
export function planOrdinal(mondayYMD, anchorMondayYMD) {
  const monday = startOfDay(parseYMD(mondayYMD));
  const anchor = anchorMondayYMD ? startOfDay(parseYMD(anchorMondayYMD)) : monday;
  return Math.round((monday - anchor) / (7 * DAY_MS)) + 1;
}

/** 七计划标题：一七计划 / 十四七计划 */
export function planTitle(mondayYMD, anchorMondayYMD) {
  return numToChinese(planOrdinal(mondayYMD, anchorMondayYMD)) + '七计划';
}

/** 该周的日期范围文案：6/9 - 6/15 */
export function weekRangeLabel(mondayYMD) {
  const m = parseYMD(mondayYMD);
  const sun = new Date(m);
  sun.setDate(sun.getDate() + 6);
  return `${m.getMonth() + 1}/${m.getDate()} - ${sun.getMonth() + 1}/${sun.getDate()}`;
}

/** 在 ymd 基础上加 n 天，返回 YYYY-MM-DD */
export function shiftDays(ymd, n) {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return fmtYMD(d);
}

/** 将任务列表按象限分组 */
export function groupByQuadrant(tasks, threshold = 7) {
  const groups = { Q1: [], Q2: [], Q3: [], Q4: [] };
  tasks.filter((t) => !t.done && !t.deleted).forEach((t) => {
    const q = quadrantOf(t, threshold);
    groups[q].push(t);
  });
  return groups;
}

/** 模糊匹配任务标题 */
export function matchTask(tasks, keyword) {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return null;
  // 先精确包含
  let hit = tasks.find((t) => t.title.toLowerCase().includes(kw));
  if (hit) return hit;
  // 再尝试前4字匹配
  if (kw.length >= 2) {
    hit = tasks.find((t) => t.title.toLowerCase().includes(kw.slice(0, 4)));
  }
  return hit || null;
}

/**
 * 判断某个习惯在指定日期是否应出现
 * repeatRule: '每天' | '工作日' | '周末' | '自定义'
 * customDays?: number[]  周一=1 ... 周日=7
 */
export function isHabitActiveOnDate(habit, date) {
  const d = typeof date === 'string' ? parseYMD(date) : new Date(date);
  const wd = d.getDay() === 0 ? 7 : d.getDay(); // 1=周一 ... 7=周日
  const rule = habit.repeatRule || '每天';
  if (rule === '每天') return true;
  if (rule === '工作日') return wd >= 1 && wd <= 5;
  if (rule === '周末') return wd >= 6 && wd <= 7;
  if (rule === '自定义') {
    const days = Array.isArray(habit.customDays) ? habit.customDays : [];
    return days.includes(wd);
  }
  return true;
}

/** 判断习惯今天是否应该显示 */
export function isHabitActiveToday(habit) {
  return isHabitActiveOnDate(habit, new Date());
}

/** 文本简单分块（按段落，每块不超过 maxLen 字符） */
export function splitTextIntoChunks(text, maxLen = 256) {
  if (!text) return [];
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if (current.length + p.length + 1 > maxLen) {
      if (current) chunks.push(current.trim());
      current = p.length > maxLen ? p.slice(0, maxLen) : p;
    } else {
      current = current ? current + '\n' + p : p;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [text.trim()];
}

/** 笔记/日记 预处理成适合 embedding 的文本 */
export function noteForEmbedding(note) {
  const parts = [];
  if (note.title) parts.push(`标题：${note.title}`);
  if (Array.isArray(note.tags) && note.tags.length) parts.push(`标签：${note.tags.join(' ')}`);
  if (note.content) parts.push(note.content);
  return parts.join('\n').slice(0, 8000);
}

/** 向量余弦相似度（a, b 为等长 number[]） */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 对检索结果做简单重排序：时间衰减 + 关键字匹配 */
export function rerankNotes(results, queryText, options = {}) {
  const { timeDecay = 0.05, keywordBoost = 0.03 } = options;
  const queryWords = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  const now = Date.now();
  return results.map((r) => {
    let score = r.score;
    const ts = r.updatedAt || r.createdAt || r.date;
    if (ts) {
      const days = (now - new Date(ts).getTime()) / (86400000);
      score *= Math.exp(-timeDecay * days);
    }
    const text = `${r.title || ''} ${r.content || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
    let hits = 0;
    for (const w of queryWords) {
      if (text.includes(w)) hits += 1;
    }
    if (queryWords.length > 0) {
      score += (hits / queryWords.length) * keywordBoost;
    }
    return { ...r, rerankScore: score };
  }).sort((a, b) => b.rerankScore - a.rerankScore);
}

/** 从设置中读取 embedding 配置（兼容旧字段，v1.1 去掉硬编码默认值） */
export function getEmbeddingConfig(settings) {
  return {
    apiKey: settings.embeddingApiKey || settings.llmApiKey || settings.aiApiKey || '',
    baseUrl: settings.embeddingBaseUrl || settings.llmBaseUrl || settings.aiBaseUrl || '',
    model: settings.embeddingModel || settings.aiModel || '',
  };
}

/** 从设置中读取 LLM 配置（兼容旧字段，v1.1 去掉硬编码默认值） */
export function getLLMConfig(settings) {
  return {
    apiKey: settings.llmApiKey || settings.aiApiKey || '',
    baseUrl: settings.llmBaseUrl || settings.aiBaseUrl || '',
    model: settings.llmModel || settings.aiModel || '',
  };
}
