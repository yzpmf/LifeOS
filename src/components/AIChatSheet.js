// ============================================================
//  Life OS — AI 助手对话弹窗（接入真实 LLM API）
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import { COLORS, WEEKDAYS, COURSE_COLORS } from '../constants';
import { daysLeft, fmtDDL, matchTask, todayWeekday, todayStr, quadrantOf, fmtYMD, parseYMD } from '../utils/helpers';

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
          date: {
            type: 'string',
            description: '查询日期，格式 YYYY-MM-DD。不填则默认今天。',
          },
          range: {
            type: 'string',
            enum: ['day', 'week'],
            description: '查询范围：day=单日，week=本周。默认 day。',
          },
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
        properties: {
          task_title: {
            type: 'string',
            description: '任务标题或关键词，用于匹配。',
          },
        },
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
          ddl_days: {
            type: 'number',
            description: '截止日期距今天的天数。例如明天=1，7天后=7。不填则无截止日期。',
          },
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
        properties: {
          habit_name: {
            type: 'string',
            description: '习惯名称或关键词。',
          },
        },
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
          quadrant: {
            type: 'string',
            enum: ['Q1', 'Q2', 'Q3', 'Q4', 'all'],
            description: '按象限筛选。all=全部。',
          },
          status: {
            type: 'string',
            enum: ['active', 'done', 'all'],
            description: '任务状态。active=进行中，done=已完成。默认 active。',
          },
        },
      },
    },
  },
];

// ---- 构建系统 prompt ----
function buildSystemPrompt(tasks, courses, habits, habitRecords, settings) {
  const today = todayStr();
  const wd = todayWeekday();
  const todayCourses = courses.filter((c) => c.dayOfWeek === wd);
  const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
  const overdue = activeTasks.filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) < 0);
  const undoneHabits = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][today]);

  return `你是 Life OS 的 AI 助手，帮助用户管理日程、任务和习惯。用简洁友好的中文回复。

当前日期：${today} ${WEEKDAYS[wd === 7 ? 0 : wd]}

今日课程：
${todayCourses.length ? todayCourses.map((c) => `- ${c.title} ${c.startTime}-${c.endTime} @${c.location}`).join('\n') : '无'}

进行中任务（${activeTasks.length} 项）：
${activeTasks.map((t) => `- ${t.title} [${fmtDDL(t.ddl)}]${t.urgent ? ' ⚡紧急' : ''}`).join('\n')}

${overdue.length ? `⚠️ 逾期任务：${overdue.map((t) => t.title).join('、')}` : ''}

打卡习惯（${habits.length} 项）：
${habits.map((h) => `- ${h.icon}${h.name} ${undoneHabits.includes(h) ? '❌未打卡' : '✅已打卡'}`).join('\n')}

规则：
- 用户提到"做完了/搞定/交了"等，调用 complete_task
- 用户要创建任务，调用 create_task
- 用户要查安排，调用 get_schedule
- 用户要打卡，调用 checkin_habit
- 匹配不到时友好询问
- 回复简洁，适当用 emoji`;
}

// ---- 执行工具函数 ----
function executeTool(name, args, { tasks, courses, habits, habitRecords, settings, onCompleteTask, onCheckinHabit, onCreateTask }) {
  switch (name) {
    case 'get_schedule': {
      const dateStr = args.date || todayStr();
      const targetDate = parseYMD(dateStr);
      const targetWd = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      const dayCourses = courses.filter((c) => c.dayOfWeek === targetWd);
      const threshold = settings.threshold || 7;
      const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
      const soonTasks = activeTasks
        .filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) >= 0 && daysLeft(t.ddl) <= threshold)
        .sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      const overdueTasks = activeTasks.filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) < 0);
      const undoneHabits = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][dateStr]);

      return JSON.stringify({
        date: dateStr,
        weekday: WEEKDAYS[targetWd === 7 ? 0 : targetWd],
        courses: dayCourses.map((c) => ({ title: c.title, time: `${c.startTime}-${c.endTime}`, location: c.location })),
        overdue_tasks: overdueTasks.map((t) => ({ title: t.title, ddl: fmtDDL(t.ddl) })),
        upcoming_tasks: soonTasks.map((t) => ({ title: t.title, ddl: fmtDDL(t.ddl) })),
        undone_habits: undoneHabits.map((h) => h.icon + h.name),
      });
    }

    case 'complete_task': {
      const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
      const hit = matchTask(activeTasks, args.task_title);
      if (hit) {
        onCompleteTask(hit.id);
        return JSON.stringify({ success: true, message: `已标记「${hit.title}」为完成` });
      }
      return JSON.stringify({ success: false, message: `未找到匹配「${args.task_title}」的任务` });
    }

    case 'create_task': {
      const today = new Date();
      let ddl = null;
      if (args.ddl_days != null) {
        const d = new Date(today);
        d.setDate(d.getDate() + args.ddl_days);
        ddl = fmtYMD(d);
      }
      onCreateTask({
        title: args.title,
        ddl,
        urgent: args.urgent || false,
        note: '',
      });
      return JSON.stringify({ success: true, message: `已创建任务「${args.title}」${ddl ? `，截止 ${ddl}` : ''}` });
    }

    case 'checkin_habit': {
      const hit = habits.find((h) => h.name.includes(args.habit_name) || args.habit_name.includes(h.name.slice(0, 2)));
      if (hit) {
        onCheckinHabit(hit.id);
        return JSON.stringify({ success: true, message: `已打卡「${hit.name}」` });
      }
      return JSON.stringify({ success: false, message: `未找到匹配「${args.habit_name}」的习惯` });
    }

    case 'query_tasks': {
      const threshold = settings.threshold || 7;
      let filtered = tasks.filter((t) => !t.deleted);
      if (args.status === 'active') filtered = filtered.filter((t) => !t.done);
      else if (args.status === 'done') filtered = filtered.filter((t) => t.done);
      if (args.quadrant && args.quadrant !== 'all') {
        filtered = filtered.filter((t) => quadrantOf(t, threshold) === args.quadrant);
      }
      return JSON.stringify({
        tasks: filtered.map((t) => ({
          title: t.title,
          quadrant: quadrantOf(t, threshold),
          ddl: fmtDDL(t.ddl),
          urgent: t.urgent,
          done: t.done,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `未知工具: ${name}` });
  }
}

// ---- 调用 LLM API ----
async function callLLM(messages, settings) {
  const { aiBaseUrl, aiApiKey, aiModel } = settings;
  if (!aiApiKey) {
    throw new Error('NO_API_KEY');
  }

  const url = `${aiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: aiModel || 'gpt-4o-mini',
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API 请求失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }

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
  const { aiBaseUrl, aiApiKey, aiModel } = settings;
  if (!aiApiKey) throw new Error('NO_API_KEY');

  const url = `${aiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: aiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SCHEDULE_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '这是我的课程表截图，请识别并按要求输出 JSON 数组。' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 2048,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`识别失败 (${resp.status}): ${errText.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseCoursesJson(content);
}

// 解析模型返回的课程 JSON（容错：去除代码块、提取数组）
function parseCoursesJson(text) {
  let s = String(text).trim();
  s = s.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  let arr;
  try {
    arr = JSON.parse(s);
  } catch (e) {
    throw new Error('无法解析识别结果，请换一张更清晰的截图重试。');
  }
  if (!Array.isArray(arr)) throw new Error('识别结果格式异常。');

  return arr
    .map((c, i) => {
      const day = parseInt(c.dayOfWeek, 10);
      if (!c.title || !day || day < 1 || day > 7) return null;
      return {
        title: String(c.title).trim(),
        teacher: c.teacher ? String(c.teacher).trim() : '',
        location: c.location ? String(c.location).trim() : '',
        dayOfWeek: day,
        startTime: /^\d{1,2}:\d{2}$/.test(c.startTime) ? c.startTime : '08:00',
        endTime: /^\d{1,2}:\d{2}$/.test(c.endTime) ? c.endTime : '09:40',
        color: COURSE_COLORS[i % COURSE_COLORS.length],
        temporary: false,
        date: null,
        startWeek: parseInt(c.startWeek, 10) || 1,
        endWeek: parseInt(c.endWeek, 10) || 16,
        weekParity: ['ALL', 'ODD', 'EVEN'].includes(c.weekParity) ? c.weekParity : 'ALL',
      };
    })
    .filter(Boolean);
}

// ---- 主组件 ----
export default function AIChatSheet({ visible, onClose, tasks, habits, habitRecords, courses, settings, onCompleteTask, onCheckinHabit, onCreateTask, onImportCourses }) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSecs, setImportSecs] = useState(0); // 截图识别已用秒数，用于「耗时较长」提示
  const scrollRef = useRef(null);
  const hasApiKey = !!(settings && settings.aiApiKey);

  // 识别期间每秒计时，提示文案随时间升级，避免用户以为卡死
  useEffect(() => {
    if (!importing) { setImportSecs(0); return; }
    const t = setInterval(() => setImportSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [importing]);

  // 初始化欢迎消息
  useEffect(() => {
    if (visible && msgs.length === 0) {
      const welcome = hasApiKey
        ? '你好！我是 Life OS AI 助手\n\n我可以帮你：\n• 查询今天/明天/本周的安排\n• 标记任务完成\n• 创建新任务\n• 完成打卡\n\n直接用自然语言告诉我你想做什么！'
        : '你好！我是 Life OS 助手\n\n请先在「我的」页面配置 AI API Key，才能使用智能对话功能。\n\n当前为演示模式，仅支持基础指令。';
      setMsgs([{ role: 'ai', text: welcome }]);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [visible, msgs]);

  const addMsg = useCallback((role, text) => {
    setMsgs((m) => [...m, { role, text }]);
  }, []);

  // ---- 真实 API 调用流程 ----
  const sendToAI = useCallback(async (userText) => {
    if (!hasApiKey) {
      // 演示模式：简单正则匹配
      demoReply(userText);
      return;
    }

    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(tasks, courses, habits, habitRecords, settings);
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...msgs.filter((m) => m.role !== 'system').map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: userText },
      ];

      // 多轮工具调用循环（最多 3 轮）
      let response;
      for (let round = 0; round < 3; round++) {
        response = await callLLM(chatMessages, settings);

        if (response.tool_calls && response.tool_calls.length > 0) {
          // 有工具调用
          chatMessages.push(response);

          for (const tc of response.tool_calls) {
            const fnName = tc.function.name;
            let fnArgs = {};
            try {
              fnArgs = JSON.parse(tc.function.arguments);
            } catch (e) {
              fnArgs = {};
            }

            const result = executeTool(fnName, fnArgs, {
              tasks, courses, habits, habitRecords, settings,
              onCompleteTask, onCheckinHabit, onCreateTask,
            });

            chatMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
          }
          // 继续循环，让 LLM 基于工具结果生成回复
        } else {
          // 没有工具调用，直接返回文本
          break;
        }
      }

      const replyText = response.content || '操作已完成';
      addMsg('ai', replyText);
    } catch (err) {
      console.warn('AI 调用失败:', err);
      if (err.message === 'NO_API_KEY') {
        addMsg('ai', '请先在「我的」页面配置 AI API Key。');
      } else {
        addMsg('ai', `${err.message}\n\n可以检查 API 配置是否正确，或稍后重试。`);
      }
    } finally {
      setLoading(false);
    }
  }, [tasks, courses, habits, habitRecords, settings, msgs, hasApiKey, onCompleteTask, onCheckinHabit, onCreateTask, addMsg]);

  // ---- 演示模式回复 ----
  const demoReply = useCallback((userText) => {
    const t = userText.trim();

    if (/完成|做完|搞定|交了|写完|做好了|弄完了/.test(t)) {
      const activeTasks = tasks.filter((x) => !x.done && !x.deleted);
      const keyword = t.replace(/(完成|做完|搞定|了|交了|写完|做好了|弄完了|帮我|把|一下)/g, '').trim();
      const hit = matchTask(activeTasks, keyword);
      if (hit) {
        onCompleteTask(hit.id);
        addMsg('ai', `已帮你把「${hit.title}」标记为完成\n干得漂亮！`);
      } else {
        addMsg('ai', '没匹配到对应的任务，能说得更具体一点吗？\n试试直接说任务名称。');
      }
      return;
    }

    if (/打卡|签到/.test(t)) {
      const keyword = t.replace(/(打卡|签到|了|今天|帮我)/g, '').trim();
      const hit = habits.find((h) => h.name.includes(keyword) || keyword.includes(h.name.slice(0, 2)));
      if (hit) {
        onCheckinHabit(hit.id);
        addMsg('ai', `已帮你打卡「${hit.name}」🔥\n坚持就是胜利！`);
      } else {
        addMsg('ai', '没找到对应的习惯，能说得更具体吗？');
      }
      return;
    }

    if (/今天|今日|安排|日程|什么事|有什么/.test(t)) {
      const wd = todayWeekday();
      const todayCourses = courses.filter((c) => c.dayOfWeek === wd);
      const activeTasks = tasks.filter((x) => !x.done && !x.deleted);
      const threshold = settings.threshold || 7;
      const soon = activeTasks
        .filter((x) => daysLeft(x.ddl) !== null && daysLeft(x.ddl) >= 0 && daysLeft(x.ddl) <= threshold)
        .sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      const overdue = activeTasks.filter((x) => daysLeft(x.ddl) !== null && daysLeft(x.ddl) < 0);
      const undone = habits.filter((h) => !habitRecords[h.id] || !habitRecords[h.id][todayStr()]);

      let out = `今天 ${WEEKDAYS[wd === 7 ? 0 : wd]}：\n\n`;
      if (todayCourses.length) {
        out += `课程：\n${todayCourses.map((c) => `  • ${c.title} ${c.startTime}-${c.endTime} @${c.location}`).join('\n')}\n\n`;
      } else {
        out += '今天没课\n\n';
      }
      if (overdue.length) {
        out += `已逾期：\n${overdue.map((x) => `  • ${x.title} (${fmtDDL(x.ddl)})`).join('\n')}\n\n`;
      }
      if (soon.length) {
        out += `临近任务：\n${soon.map((x) => `  • ${x.title} [${fmtDDL(x.ddl)}]`).join('\n')}\n\n`;
      } else if (!overdue.length) {
        out += '近期无截止任务\n\n';
      }
      if (undone.length) {
        out += `🔥 待打卡：${undone.map((h) => h.icon + h.name).join('、')}`;
      } else {
        out += '🔥 今天都打卡完啦';
      }
      addMsg('ai', out);
      return;
    }

    if (/这周|本周|一周/.test(t)) {
      const weekTasks = tasks
        .filter((x) => !x.done && !x.deleted && daysLeft(x.ddl) !== null && daysLeft(x.ddl) >= 0 && daysLeft(x.ddl) <= 7)
        .sort((a, b) => daysLeft(a.ddl) - daysLeft(b.ddl));
      if (weekTasks.length === 0) {
        addMsg('ai', '这周没有截止的任务，可以轻松一下！');
      } else {
        addMsg('ai', `本周待办：\n${weekTasks.map((x) => `  • ${x.title} [${fmtDDL(x.ddl)}]`).join('\n')}`);
      }
      return;
    }

    addMsg('ai', '请先在「我的」页面配置 AI API Key，即可使用完整智能对话。\n\n当前为演示模式，支持：\n• 「今天有什么安排」\n• 「XX 做完了」\n• 「打卡 XX」\n• 「这周有什么 deadline」');
  }, [tasks, courses, habits, habitRecords, settings, onCompleteTask, onCheckinHabit, addMsg]);

  // ---- 截图导入课程表 ----
  const importSchedule = useCallback(async () => {
    if (importing || loading) return;
    if (!hasApiKey) {
      addMsg('ai', '截图导入需要 AI 能力，请先在「我的」页面配置支持图片识别的模型（如 gpt-4o / gpt-4o-mini）。');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        addMsg('ai', '没有相册访问权限，无法读取截图。请到系统设置里开启后重试。');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;

      const asset = result.assets[0];
      addMsg('me', '[课程表截图]');
      setImporting(true);

      const mime = asset.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const parsed = await extractCoursesFromImage(dataUrl, settings);

      if (!parsed.length) {
        addMsg('ai', '没能从这张图里识别出课程\n可以试试更清晰、只包含课程表的截图。');
        return;
      }

      const prevCount = courses?.length || 0;
      onImportCourses?.(parsed);
      const preview = parsed
        .slice(0, 12)
        .map((c) => `• ${WEEKDAYS[c.dayOfWeek === 7 ? 0 : c.dayOfWeek]} ${c.startTime}-${c.endTime} ${c.title}${c.location ? ' @' + c.location : ''}`)
        .join('\n');
      const clearedNote = prevCount > 0 ? `已清空原有 ${prevCount} 门课程，并替换为本次导入的内容。\n\n` : '';
      addMsg('ai', `${clearedNote}已识别并导入 ${parsed.length} 门课程：\n\n${preview}${parsed.length > 12 ? `\n…等共 ${parsed.length} 门` : ''}\n\n可到「课程表」页面查看，识别有误的话长按课程可删除、点击可编辑。`);
    } catch (err) {
      console.warn('截图导入失败:', err);
      addMsg('ai', err.message === 'NO_API_KEY'
        ? '请先在「我的」页面配置 AI API Key。'
        : `${err.message || '导入失败，请稍后重试。'}`);
    } finally {
      setImporting(false);
    }
  }, [importing, loading, hasApiKey, settings, addMsg, onImportCourses, courses]);

  const send = () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    addMsg('me', userMsg);
    setTimeout(() => sendToAI(userMsg), 100);
  };

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
              <Text style={[styles.demoText, hasApiKey && styles.liveText]}>
                {hasApiKey ? '已连接' : '演示'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.msgList}
            contentContainerStyle={styles.msgListContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {msgs.map((m, i) => (
              <View key={i} style={[styles.msgBubble, m.role === 'me' ? styles.msgMe : styles.msgAi]}>
                <Text style={[styles.msgText, m.role === 'me' && styles.msgTextMe]}>
                  {m.text}
                </Text>
              </View>
            ))}
            {(loading || importing) && (
              <View style={[styles.msgBubble, styles.msgAi]}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={styles.typingText}>
                    {!importing
                      ? '思考中...'
                      : importSecs < 8
                        ? '识别课程表中...'
                        : importSecs < 20
                          ? `识别课程表中…视觉模型较慢，请再稍候（已 ${importSecs}s）`
                          : `仍在识别，图越大越慢，请耐心等待（已 ${importSecs}s）`}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.imgBtn, (importing || loading) && styles.sendBtnDisabled]}
              onPress={importSchedule}
              activeOpacity={0.8}
              disabled={importing || loading}
            >
              <Feather name="image" size={20} color={COLORS.sub} />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              placeholder={hasApiKey ? "今天有什么安排？" : "请先配置 API Key..."}
              placeholderTextColor={COLORS.muted}
              style={styles.chatInput}
              returnKeyType="send"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
              onPress={send}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.sendBtnText}>{loading ? '...' : '发送'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    height: '78%',
  },
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
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  msgMe: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
  },
  msgAi: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 21, color: COLORS.ink },
  msgTextMe: { color: '#fff' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: COLORS.muted },
  inputRow: { flexDirection: 'row', gap: 8, paddingTop: 8, alignItems: 'stretch' },
  imgBtn: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
  },
  imgBtnText: { fontSize: 20 },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
  },
  sendBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.line,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
