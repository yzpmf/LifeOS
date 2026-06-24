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

/** 取某日期字符串的星期数字 (1=周一, 7=周日) */
export function weekdayOf(dateStr) {
  const d = parseYMD(dateStr).getDay();
  return d === 0 ? 7 : d;
}

/** 判断一节课（含临时课）今天这一周的某个星期 d 是否要显示 */
export function isCourseOnDay(course, day, currentWeek) {
  if (course.temporary) {
    // 临时课：只在它指定那天、且属于本周时显示
    return !!course.date && isSameWeek(course.date) && weekdayOf(course.date) === day;
  }
  return course.dayOfWeek === day && isCourseActiveThisWeek(course, currentWeek);
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
