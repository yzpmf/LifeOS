// ============================================================
//  Life OS — 全局常量
// ============================================================

export const COLORS = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  ink: '#1A1815',
  sub: '#6B6560',
  muted: '#9E9890',
  line: '#E5DFD5',
  accent: '#E05A33',
  accentSoft: '#FBE8E0',

  // 四象限配色
  q1: '#D43B2F', // 马上做 — 红
  q2: '#D4930A', // 计划做 — 金
  q3: '#2B7CB5', // 顺手做 — 蓝
  q4: '#3A9D6A', // 有空做 — 绿

  white: '#FFFFFF',
  success: '#3A9D6A',
  warning: '#D4930A',
  danger: '#D43B2F',
};

export const QUADRANTS = {
  Q1: { key: 'Q1', name: '马上做', desc: '短期 · 紧急', color: COLORS.q1 },
  Q2: { key: 'Q2', name: '计划做', desc: '长期 · 紧急', color: COLORS.q2 },
  Q3: { key: 'Q3', name: '顺手做', desc: '短期 · 不紧急', color: COLORS.q3 },
  Q4: { key: 'Q4', name: '有空做', desc: '长期 · 不紧急', color: COLORS.q4 },
};

// 短期阈值（天），剩余天数 ≤ 此值视为短期
export const DEFAULT_THRESHOLD = 7;

// 存储 key
export const STORAGE_KEYS = {
  tasks: 'lifeos.tasks.v1',
  courses: 'lifeos.courses.v1',
  habits: 'lifeos.habits.v1',
  habitRecords: 'lifeos.habitRecords.v1',
  settings: 'lifeos.settings.v1',
  chatHistory: 'lifeos.chatHistory.v1',
  plans: 'lifeos.plans.v1',
};

// 默认设置
export const DEFAULT_SETTINGS = {
  threshold: DEFAULT_THRESHOLD,
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  notificationsEnabled: true,
  semesterStart: '2025-09-01', // 开学日期，用于计算当前第几周
  planAnchorMonday: null, // 七计划起始周（首次使用那周的周一），用于连续编号 一七/二七…
};

// 星期名称
export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 7]; // 周一~周日

// DDL 快捷选项
export const DDL_PRESETS = [
  { label: '今天', days: 0 },
  { label: '明天', days: 1 },
  { label: '3天后', days: 3 },
  { label: '7天后', days: 7 },
  { label: '14天后', days: 14 },
  { label: '30天后', days: 30 },
];

// 课程颜色选项
export const COURSE_COLORS = [
  '#D43B2F', '#D4930A', '#2B7CB5', '#3A9D6A',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

// 习惯图标选项
export const HABIT_ICONS = ['📖', '💧', '🏃', '🧘', '✍️', '🎯', '💪', '🍎', '😴', '🎵'];
