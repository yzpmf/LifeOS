// ============================================================
//  Life OS — AI 助手对话弹窗（接入真实 LLM API，支持 Markdown）
// ============================================================
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
// expo-image-picker 在 Web 端不可用，做 fallback
let ImagePicker = { launchImageLibraryAsync: async () => ({ canceled: true }), MediaTypeOptions: { Images: 'Images' } };
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker not available (web)');
}
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import { COLORS, WEEKDAYS, COURSE_COLORS } from '../constants';
import {
  daysLeft, fmtDDL, matchTask, todayWeekday, todayStr, quadrantOf, fmtYMD, parseYMD,
  isCourseOnDay, getCurrentWeek, startOfWeek, fmtDate,
  getLLMConfig,
} from '../utils/helpers';
import { searchNotes, formatNotesContext, allNotesFromState } from '../utils/embeddings';

// ---- Markdown 渲染（可能未安装，fallback 到纯文本）----
let Markdown = null;
try {
  Markdown = require('react-native-markdown-display').default;
} catch (e) {
  // react-native-markdown-display 未安装，AI 回复用纯文本
}

// ---- Markdown 样式 ----
const mdStyles = StyleSheet.create({
  body: { color: COLORS.ink, fontSize: 14, lineHeight: 21 },
  heading1: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginVertical: 6 },
  heading2: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginVertical: 4 },
  heading3: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginVertical: 2 },
  paragraph: { marginVertical: 4 },
  list_item: { marginVertical: 2, flexDirection: 'row' },
  blockquote: { borderLeftWidth: 3, borderLeftColor: COLORS.accent, paddingLeft: 10, marginVertical: 4, backgroundColor: COLORS.accentSoft + '40' },
  code_inline: { backgroundColor: COLORS.line, color: COLORS.accent, fontFamily: 'monospace', fontSize: 13, paddingHorizontal: 4, borderRadius: 4 },
  fence: { backgroundColor: COLORS.line + '60', padding: 10, borderRadius: 8, marginVertical: 4, fontFamily: 'monospace', fontSize: 12 },
  link: { color: COLORS.q3, textDecorationLine: 'underline' },
  hr: { borderBottomWidth: 1, borderBottomColor: COLORS.line, marginVertical: 8 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
});

// ---- 工具函数定义（供 LLM function calling 使用）----
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: '查询用户的日程安排，包括课程、任务、打卡习惯。可以查今天、明天、本周或指定日期。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '查询日期，格式 YYYY-MM-DD。不填则默认今天。' },
          range: { type: 'string', enum: ['day', 'week'], description: '查询范围：day=单日，week=本周。默认 day。' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: '标记一个待办任务为已完成。当用户说"XX做完了"、"XX搞定了"、"XX交了"等时调用。',
      parameters: {
        type: 'object',
        properties: { task_title: { type: 'string', description: '任务标题或关键词，用于匹配。' } },
        required: ['task_title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: '创建一个新的待办任务。当用户说"帮我创建任务"、"添加一个待办"等时调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题' },
          ddl_days: { type: 'number', description: '截止日期距今天的天数。例如明天=1，7天后=7。不填则无截止日期。' },
          urgent: { type: 'boolean', description: '是否紧急。默认 false。' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkin_habit',
      description: '帮用户完成一个打卡习惯。当用户说"打卡XX"、"XX打卡了"等时调用。',
      parameters: {
        type: 'object',
        properties: { habit_name: { type: 'string', description: '习惯名称或关键词。' } },
        required: ['habit_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_tasks',
      description: '查询任务列表。可按象限、状态筛选。',
      parameters: {
        type: 'object',
        properties: {
          quadrant: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4', 'all'], description: '按象限筛选。all=全部。' },
          status: { type: 'string', enum: ['active', 'done', 'all'], description: '任务状态。active=进行中，done=已完成。默认 active。' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: '在用户的日记、学习感悟、笔记中搜索与问题相关的内容。当用户问"我之前学过什么"、"我之前记过XX"、"我上周学了什么"、"关于XX我有什么记录"等时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索问题，例如"我之前学过的 React 知识点"、"我上周的感悟"' },
          top_k: { type: 'number', description: '返回几条最相关记录。默认 5。' },
        },
        required: ['query'],
      },
    },
  },
];

// ---- 课程过滤：结合当前周、单双周、临时课程 ----
function filterCoursesForDay(courses, dateStr, settings) {
  const currentWeek = getCurrentWeek(settings.semesterStart);
  const targetDate = parseYMD(dateStr);
  const targetWd = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
  return courses.filter((c) => isCourseOnDay(c, targetWd, currentWeek, settings.semesterStart) && !c.deleted);
}

// ---- 构建系统 prompt ----
function buildSystemPrompt(tasks, courses, habits, habitRecords, settings, notesContext = '') {
  const today = todayStr();
  const wd = todayWeekday();
  const todayCourses = filterCoursesForDay(courses, today, settings);
  const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
  const overdue = activeTasks.filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) < 0);
  const undoneHabits = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][today]);

  return `你是 Life OS 的 AI 助手，帮助用户管理日程、任务、习惯和学习笔记。用简洁友好的中文回复。

当前日期：${today} ${WEEKDAYS[wd === 7 ? 0 : wd]}

今日课程（已按当前周次、单双周、临时课程过滤）：
${todayCourses.length ? todayCourses.map((c) => `- ${c.title} ${c.startTime}-${c.endTime}${c.location ? ' @' + c.location : ''}${c.temporary ? '（临时课）' : ''}`).join('\n') : '无'}

进行中任务（${activeTasks.length} 项）：
${activeTasks.map((t) => `- ${t.title} [${fmtDDL(t.ddl)}]${t.urgent ? ' ⚡紧急' : ''}`).join('\n')}

${overdue.length ? `⚠️ 逾期任务：${overdue.map((t) => t.title).join('、')}` : ''}

打卡习惯（${habits.length} 项）：
${habits.map((h) => `- ${h.icon}${h.name} ${undoneHabits.includes(h) ? '❌未打卡' : '✅已打卡'}`).join('\n')}

${notesContext ? notesContext + '\n\n' : ''}
规则：
- 用户提到"做完了/搞定/交了"等，调用 complete_task
- 用户要创建任务，调用 create_task
- 用户要查安排，调用 get_schedule
- 用户要打卡，调用 checkin_habit
- 用户询问过往笔记、学习记录、日记相关内容，调用 search_notes
- 如果用户问"我学过什么"、"我之前记过"、"关于XX的记录"，先 search_notes 再回答
- 匹配不到时友好询问
- 回复可用 Markdown 格式（标题、列表、加粗等），适当用 emoji`;
}

// ---- 执行工具函数 ----
function executeTool(name, args, ctx) {
  const { tasks, courses, habits, habitRecords, settings, onCompleteTask, onCheckinHabit, onCreateTask, allNotes } = ctx;
  switch (name) {
    case 'get_schedule': {
      const dateStr = args.date || todayStr();
      const targetDate = parseYMD(dateStr);
      const targetWd = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      const dayCourses = filterCoursesForDay(courses, dateStr, settings);
      const threshold = settings.threshold || 7;
      const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
      const soonTasks = activeTasks
        .filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) >= 0 && daysLeft(t.ddl) <= threshold)
        .sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      const overdueTasks = activeTasks.filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) < 0);
      const undoneHabits = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][dateStr]);
      return JSON.stringify({
        date: dateStr, weekday: WEEKDAYS[targetWd === 7 ? 0 : targetWd],
        courses: dayCourses.map((c) => ({ title: c.title, time: `${c.startTime}-${c.endTime}`, location: c.location, temporary: !!c.temporary })),
        overdue_tasks: overdueTasks.map((t) => ({ title: t.title, ddl: fmtDDL(t.ddl) })),
        upcoming_tasks: soonTasks.map((t) => ({ title: t.title, ddl: fmtDDL(t.ddl) })),
        undone_habits: undoneHabits.map((h) => h.icon + h.name),
      });
    }
    case 'complete_task': {
      const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
      const hit = matchTask(activeTasks, args.task_title);
      if (hit) { onCompleteTask(hit.id); return JSON.stringify({ success: true, message: `已标记「${hit.title}」为完成` }); }
      return JSON.stringify({ success: false, message: `未找到匹配「${args.task_title}」的任务` });
    }
    case 'create_task': {
      const today = new Date();
      let ddl = null;
      if (args.ddl_days != null) { const d = new Date(today); d.setDate(d.getDate() + args.ddl_days); ddl = fmtYMD(d); }
      onCreateTask({ title: args.title, ddl, urgent: args.urgent || false, note: '' });
      return JSON.stringify({ success: true, message: `已创建任务「${args.title}」${ddl ? `，截止 ${ddl}` : ''}` });
    }
    case 'checkin_habit': {
      const hit = habits.find((h) => h.name.includes(args.habit_name) || args.habit_name.includes(h.name.slice(0, 2)));
      if (hit) { onCheckinHabit(hit.id); return JSON.stringify({ success: true, message: `已打卡「${hit.name}」` }); }
      return JSON.stringify({ success: false, message: `未找到匹配「${args.habit_name}」的习惯` });
    }
    case 'query_tasks': {
      const threshold = settings.threshold || 7;
      let filtered = tasks.filter((t) => !t.deleted);
      if (args.status === 'active') filtered = filtered.filter((t) => !t.done);
      else if (args.status === 'done') filtered = filtered.filter((t) => t.done);
      if (args.quadrant && args.quadrant !== 'all') filtered = filtered.filter((t) => quadrantOf(t, threshold) === args.quadrant);
      return JSON.stringify({ tasks: filtered.map((t) => ({ title: t.title, quadrant: quadrantOf(t, threshold), ddl: fmtDDL(t.ddl), urgent: t.urgent, done: t.done })) });
    }
    case 'search_notes': {
      if (!allNotes || allNotes.length === 0) {
        return JSON.stringify({ results: [], message: '当前还没有日记或学习感悟记录。' });
      }
      // 实际检索在调用 LLM 前已同步完成，并通过 notesContext 注入 system prompt
      return JSON.stringify({ results: [], message: '请根据 system prompt 中 notesContext 的内容回答用户。' });
    }
    default: return JSON.stringify({ error: `未知工具: ${name}` });
  }
}

// ---- 调用 LLM API ----
async function callLLM(messages, settings) {
  const { apiKey, baseUrl, model } = getLLMConfig(settings);
  if (!apiKey) throw new Error('NO_API_KEY');

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = { model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.7, max_tokens: 1024 };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { const errText = await resp.text().catch(() => ''); throw new Error(`API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`); }
  const data = await resp.json();
  return data.choices[0].message;
}

// ---- 从课程表截图提取课程（视觉模型）----
const SCHEDULE_PROMPT = `你是一个课程表识别助手。用户会给你一张教务系统的课程表截图。
请识别出图中所有课程，输出一个严格的 JSON 数组，不要任何解释文字、不要 markdown 代码块。
每个课程对象包含字段：
- title: 课程名称（字符串）
- teacher: 教师姓名（没有则空字符串）
- location: 上课地点/教室（没有则空字符串）
- dayOfWeek: 星期，整数 1-7（周一=1 ... 周日=7）
- startTime: 开始时间，"HH:MM" 24小时制（若图中只有节次，按常见作息推断：1-2节08:00-09:40，3-4节10:00-11:40，5-6节14:00-15:40，7-8节16:00-17:40，晚上9-10节19:00-20:40）
- endTime: 结束时间，"HH:MM"
- startWeek: 起始周（整数，默认 1）
- endWeek: 结束周（整数，默认 16）
- weekParity: "ALL"（每周）| "ODD"（单周）| "EVEN"（双周），默认 "ALL"
同一门课如果一周上多次（不同星期/时间），拆成多个对象。只输出 JSON 数组。`;

async function extractCoursesFromImage(dataUrl, settings) {
  const { apiKey, baseUrl, model } = getLLMConfig(settings);
  if (!apiKey) throw new Error('NO_API_KEY');

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: SCHEDULE_PROMPT },
      { role: 'user', content: [{ type: 'text', text: '这是我的课程表截图，请识别并按要求输出 JSON 数组。' }, { type: 'image_url', image_url: { url: dataUrl } }] },
    ],
    temperature: 0, max_tokens: 2048,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { const errText = await resp.text().catch(() => ''); throw new Error(`识别失败 (${resp.status}): ${errText.slice(0, 200)}`); }
  const data = await resp.json();
  return parseCoursesJson(data.choices?.[0]?.message?.content || '');
}

function parseCoursesJson(text) {
  let s = String(text).trim();
  s = s.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('['), end = s.lastIndexOf(']');
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  let arr;
  try { arr = JSON.parse(s); } catch (e) { throw new Error('无法解析识别结果，请换一张更清晰的截图重试。'); }
  if (!Array.isArray(arr)) throw new Error('识别结果格式异常。');
  return arr.map((c, i) => {
    const day = parseInt(c.dayOfWeek, 10);
    if (!c.title || !day || day < 1 || day > 7) return null;
    return {
      title: String(c.title).trim(), teacher: c.teacher ? String(c.teacher).trim() : '', location: c.location ? String(c.location).trim() : '',
      dayOfWeek: day,
      startTime: /^\d{1,2}:\d{2}$/.test(c.startTime) ? c.startTime : '08:00',
      endTime: /^\d{1,2}:\d{2}$/.test(c.endTime) ? c.endTime : '09:40',
      color: COURSE_COLORS[i % COURSE_COLORS.length], temporary: false, date: null,
      startWeek: parseInt(c.startWeek, 10) || 1, endWeek: parseInt(c.endWeek, 10) || 16,
      weekParity: ['ALL', 'ODD', 'EVEN'].includes(c.weekParity) ? c.weekParity : 'ALL',
    };
  }).filter(Boolean);
}

// ---- 消息气泡渲染（AI 消息用 Markdown，用户消息用纯文本）----
function MsgBubble({ role, text }) {
  if (role === 'me') {
    return (
      <View style={[styles.msgBubble, styles.msgMe]}>
        <Text style={styles.msgTextMe}>{text}</Text>
      </View>
    );
  }

  // AI 回复：有 Markdown 库就用 Markdown 渲染，否则回退到纯文本
  if (Markdown) {
    return (
      <View style={[styles.msgBubble, styles.msgAi]}>
        <Markdown style={mdStyles}>
          {text}
        </Markdown>
      </View>
    );
  }

  return (
    <View style={[styles.msgBubble, styles.msgAi]}>
      <Text style={styles.msgText}>{text}</Text>
    </View>
  );
}

// ---- 主组件 ----
export default function AIChatSheet({ visible, onClose, tasks, habits, habitRecords, courses, settings, onCompleteTask, onCheckinHabit, onCreateTask, onImportCourses, diary, insights }) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSecs, setImportSecs] = useState(0);
  const [, setSearchContext] = useState('');
  const scrollRef = useRef(null);
  const llmCfg = getLLMConfig(settings);
  const hasApiKey = !!(llmCfg.apiKey);

  useEffect(() => { if (!importing) { setImportSecs(0); return; } const t = setInterval(() => setImportSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [importing]);

  useEffect(() => {
    if (visible && msgs.length === 0) {
      const welcome = hasApiKey
        ? '你好！我是 Life OS AI 助手\n\n我可以帮你：\n- 查询今天/明天/本周的安排\n- 标记任务完成\n- 创建新任务\n- 完成打卡\n- 搜索你的日记和学习感悟\n\n直接用自然语言告诉我你想做什么！'
        : '你好！我是 Life OS 助手\n\n请先在「我的」页面配置 AI API Key，才能使用智能对话功能。\n\n当前为演示模式，仅支持基础指令。';
      setMsgs([{ role: 'ai', text: welcome }]);
    }
  }, [visible]);

  useEffect(() => { if (visible) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100); }, [visible, msgs]);

  const addMsg = useCallback((role, text) => setMsgs((m) => [...m, { role, text }]), []);

  const allNotes = useMemo(() => allNotesFromState({ diary, insights }), [diary, insights]);

  const sendToAI = useCallback(async (userText) => {
    if (!hasApiKey) { demoReply(userText); return; }
    setLoading(true);
    try {
      // 1. 先判断是否需要检索笔记
      let notesContext = '';
      const noteQuery = inferNoteQuery(userText);
      if (noteQuery) {
        try {
          const results = await searchNotes(noteQuery, allNotes, settings, { topK: 4 });
          notesContext = formatNotesContext(results, { maxChars: 2400, header: '以下是从用户日记/学习笔记中召回的相关片段：' });
          setSearchContext(notesContext);
        } catch (e) {
          console.warn('searchNotes 失败:', e);
        }
      }

      const systemPrompt = buildSystemPrompt(tasks, courses, habits, habitRecords, settings, notesContext);
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...msgs.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: userText },
      ];
      let response;
      for (let round = 0; round < 3; round++) {
        response = await callLLM(chatMessages, settings);
        if (response.tool_calls && response.tool_calls.length > 0) {
          chatMessages.push(response);
          for (const tc of response.tool_calls) {
            let fnArgs = {};
            try { fnArgs = JSON.parse(tc.function.arguments); } catch (e) {}
            const result = executeTool(tc.function.name, fnArgs, { tasks, courses, habits, habitRecords, settings, onCompleteTask, onCheckinHabit, onCreateTask, allNotes });
            chatMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
          }
        } else { break; }
      }
      addMsg('ai', response.content || '操作已完成');
    } catch (err) {
      console.warn('AI 调用失败:', err);
      if (err.message === 'NO_API_KEY') addMsg('ai', '请先在「我的」页面配置 AI API Key。');
      else addMsg('ai', `${err.message}\n\n可以检查 API 配置是否正确，或稍后重试。`);
    } finally { setLoading(false); }
  }, [tasks, courses, habits, habitRecords, settings, msgs, hasApiKey, onCompleteTask, onCheckinHabit, onCreateTask, addMsg, allNotes]);

  const demoReply = useCallback((userText) => {
    const t = userText.trim();
    if (/完成|做完|搞定|交了|写完|做好了|弄完了/.test(t)) {
      const activeTasks = tasks.filter((x) => !x.done && !x.deleted);
      const keyword = t.replace(/(完成|做完|搞定|了|交了|写完|做好了|弄完了|帮我|把|一下)/g, '').trim();
      const hit = matchTask(activeTasks, keyword);
      if (hit) { onCompleteTask(hit.id); addMsg('ai', `已帮你把「${hit.title}」标记为完成\n\n干得漂亮！`); }
      else addMsg('ai', '没匹配到对应的任务，能说得更具体一点吗？\n\n试试直接说任务名称。');
      return;
    }
    if (/打卡|签到/.test(t)) {
      const keyword = t.replace(/(打卡|签到|了|今天|帮我)/g, '').trim();
      const hit = habits.find((h) => h.name.includes(keyword) || keyword.includes(h.name.slice(0, 2)));
      if (hit) { onCheckinHabit(hit.id); addMsg('ai', `已帮你打卡「${hit.name}」🔥\n\n坚持就是胜利！`); }
      else addMsg('ai', '没找到对应的习惯，能说得更具体吗？');
      return;
    }
    if (/今天|今日|安排|日程|什么事|有什么/.test(t)) {
      const today = todayStr(); const wd = todayWeekday();
      const todayCourses = filterCoursesForDay(courses, today, settings);
      const activeTasks = tasks.filter((x) => !x.done && !x.deleted);
      const threshold = settings.threshold || 7;
      const soon = activeTasks.filter((x) => daysLeft(x.ddl) !== null && daysLeft(x.ddl) >= 0 && daysLeft(x.ddl) <= threshold).sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      const overdue = activeTasks.filter((x) => daysLeft(x.ddl) !== null && daysLeft(x.ddl) < 0);
      const undone = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][today]);
      let out = `今天 ${WEEKDAYS[wd === 7 ? 0 : wd]}：\n\n`;
      if (todayCourses.length) out += `**课程：**\n${todayCourses.map((c) => `- ${c.title} ${c.startTime}-${c.endTime}${c.location ? ' @' + c.location : ''}${c.temporary ? '（临时）' : ''}`).join('\n')}\n\n`;
      else out += '今天没课\n\n';
      if (overdue.length) out += `**⚠️ 已逾期：**\n${overdue.map((x) => `- ${x.title} (${fmtDDL(x.ddl)})`).join('\n')}\n\n`;
      if (soon.length) out += `**临近任务：**\n${soon.map((x) => `- ${x.title} [${fmtDDL(x.ddl)}]`).join('\n')}\n\n`;
      else if (!overdue.length) out += '近期无截止任务\n\n';
      if (undone.length) out += `🔥 **待打卡：** ${undone.map((h) => h.icon + h.name).join('、')}`;
      else out += '🔥 今天都打卡完啦';
      addMsg('ai', out);
      return;
    }
    if (/这周|本周|一周/.test(t)) {
      const weekTasks = tasks.filter((x) => !x.done && !x.deleted && daysLeft(x.ddl) !== null && daysLeft(x.ddl) >= 0 && daysLeft(x.ddl) <= 7).sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      if (weekTasks.length === 0) addMsg('ai', '这周没有截止的任务，可以轻松一下！');
      else addMsg('ai', `**本周待办：**\n${weekTasks.map((x) => `- ${x.title} [${fmtDDL(x.ddl)}]`).join('\n')}`);
      return;
    }
    addMsg('ai', '请先在「我的」页面配置 AI API Key，即可使用完整智能对话。\n\n当前为演示模式，支持：\n- 「今天有什么安排」\n- 「XX 做完了」\n- 「打卡 XX」\n- 「这周有什么 deadline」');
  }, [tasks, courses, habits, habitRecords, settings, onCompleteTask, onCheckinHabit, addMsg]);

  const importSchedule = useCallback(async () => {
    if (importing || loading) return;
    if (!hasApiKey) { addMsg('ai', '截图导入需要 AI 能力，请先在「我的」页面配置支持图片识别的模型（如 gpt-4o / gpt-4o-mini）。'); return; }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { addMsg('ai', '没有相册访问权限，无法读取截图。请到系统设置里开启后重试。'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      addMsg('me', '[课程表截图]');
      setImporting(true);
      const mime = asset.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const parsed = await extractCoursesFromImage(dataUrl, settings);
      if (!parsed.length) { addMsg('ai', '没能从这张图里识别出课程\n\n可以试试更清晰、只包含课程表的截图。'); return; }
      const prevCount = courses?.length || 0;
      onImportCourses?.(parsed);
      const preview = parsed.slice(0, 12).map((c) => `- ${WEEKDAYS[c.dayOfWeek === 7 ? 0 : c.dayOfWeek]} ${c.startTime}-${c.endTime} ${c.title}${c.location ? ' @' + c.location : ''}`).join('\n');
      const clearedNote = prevCount > 0 ? `已清空原有 ${prevCount} 门课程，并替换为本次导入的内容。\n\n` : '';
      addMsg('ai', `${clearedNote}已识别并导入 ${parsed.length} 门课程：\n\n${preview}${parsed.length > 12 ? `\n…等共 ${parsed.length} 门` : ''}\n\n可到「课程表」页面查看，识别有误的话长按课程可删除、点击可编辑。`);
    } catch (err) {
      console.warn('截图导入失败:', err);
      addMsg('ai', err.message === 'NO_API_KEY' ? '请先在「我的」页面配置 AI API Key。' : `${err.message || '导入失败，请稍后重试。'}`);
    } finally { setImporting(false); }
  }, [importing, loading, hasApiKey, settings, addMsg, onImportCourses, courses]);

  const send = () => { if (!input.trim() || loading) return; const userMsg = input.trim(); setInput(''); addMsg('me', userMsg); setTimeout(() => sendToAI(userMsg), 100); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Feather name="message-circle" size={20} color={COLORS.accent} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>AI 助手</Text>
            <View style={[styles.demoBadge, hasApiKey && styles.liveBadge]}>
              <Text style={[styles.demoText, hasApiKey && styles.liveText]}>{hasApiKey ? '已连接' : '演示'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={styles.msgList} contentContainerStyle={styles.msgListContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {msgs.map((m, i) => <MsgBubble key={i} role={m.role} text={m.text} />)}
            {(loading || importing) && (
              <View style={[styles.msgBubble, styles.msgAi]}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.typingText}>
                    {!importing ? '思考中...' : importSecs < 8 ? '识别课程表中...' : importSecs < 20 ? `识别课程表中…视觉模型较慢，请再稍候（已 ${importSecs}s）` : `仍在识别，图越大越慢，请耐心等待（已 ${importSecs}s）`}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TouchableOpacity style={[styles.imgBtn, (importing || loading) && styles.sendBtnDisabled]} onPress={importSchedule} activeOpacity={0.8} disabled={importing || loading}>
              <Feather name="image" size={20} color={COLORS.sub} />
            </TouchableOpacity>
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder={hasApiKey ? "今天有什么安排？" : "请先配置 API Key..."} placeholderTextColor={COLORS.muted} style={styles.chatInput} returnKeyType="send" editable={!loading} />
            <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={send} activeOpacity={0.8} disabled={loading}>
              <Text style={styles.sendBtnText}>{loading ? '...' : '发送'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

// 判断用户问题是否可能需要检索笔记
function inferNoteQuery(userText) {
  const triggers = [
    /我(?:之前|以前|上周|上个月|最近|这学期)学过?什么/,
    /我(?:之前|以前|上周|上个月|最近|这学期)记过?什么/,
    /关于.*我(?:有|记过|写过|学过)什么/,
    /(?:日记|笔记|感悟|学习)里.*(?:有|记录)/,
    /(?:搜索|查找| recall |检索).*笔记/,
    /(?:我学的|我记的|我写的).*是什么/,
  ];
  for (const r of triggers) if (r.test(userText)) return userText;
  // 如果句子中有明显「我之前」等字样，也用检索
  if (/(?:之前|以前|上周|上个月|这学期|学过的)/.test(userText)) return userText;
  return null;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, height: '78%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  headerIcon: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  demoBadge: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  demoText: { fontSize: 10, color: COLORS.accent, fontWeight: '700' },
  liveBadge: { backgroundColor: COLORS.success + '20' },
  liveText: { color: COLORS.success },
  closeBtn: { marginLeft: 'auto', padding: 4 },
  closeBtnText: { fontSize: 18, color: COLORS.muted },
  msgList: { flex: 1 },
  msgListContent: { gap: 10, paddingVertical: 8 },
  msgBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  msgMe: { alignSelf: 'flex-end', backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  msgAi: { alignSelf: 'flex-start', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 21, color: COLORS.ink },
  msgTextMe: { color: '#fff' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: COLORS.muted },
  inputRow: { flexDirection: 'row', gap: 8, paddingTop: 8, alignItems: 'stretch' },
  imgBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.ink },
  sendBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.line },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
