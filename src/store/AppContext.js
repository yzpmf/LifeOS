// ============================================================
//  Life OS — 全局状态管理 (Context + useReducer)
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import { uid, todayPlus, todayStr, calcStreak } from '../utils/helpers';

const AppContext = createContext();

// ---- 初始种子数据 ----
// 默认不预置任务与课程，新用户/清除数据后是干净的空白状态。
const seedTasks = [];

const seedCourses = [];

const seedHabits = [
  { id: uid(), name: '背单词', icon: '📖', time: '08:00', repeatRule: '每天', createdAt: todayPlus(-12) },
  { id: uid(), name: '喝水 2L', icon: '💧', time: '', repeatRule: '每天', createdAt: todayPlus(-5) },
  { id: uid(), name: '运动 30 分钟', icon: '🏃', time: '19:00', repeatRule: '每天', createdAt: todayPlus(-3) },
];

const seedHabitRecords = {};

// ---- Reducer ----
function reducer(state, action) {
  switch (action.type) {
    // 任务
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, { ...action.payload, id: uid(), done: false, deleted: false, createdAt: new Date().toISOString(), subs: [] }] };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload } : t)) };
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null } : t
        ),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.payload ? { ...t, deleted: true } : t)) };
    case 'TOGGLE_SUB':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.tid
            ? { ...t, subs: t.subs.map((s) => (s.id === action.payload.sid ? { ...s, done: !s.done } : s)) }
            : t
        ),
      };
    case 'ADD_SUB':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.tid
            ? { ...t, subs: [...t.subs, { id: uid(), text: action.payload.text, done: false }] }
            : t
        ),
      };
    case 'DELETE_SUB':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.tid
            ? { ...t, subs: t.subs.filter((s) => s.id !== action.payload.sid) }
            : t
        ),
      };

    // 课程
    case 'SET_COURSES':
      return { ...state, courses: action.payload };
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, { ...action.payload, id: uid() }] };
    case 'ADD_COURSES':
      return { ...state, courses: [...state.courses, ...action.payload.map((c) => ({ ...c, id: uid() }))] };
    case 'REPLACE_COURSES': // 整表替换：清空旧课程，换成传入的（截图导入用）
      return { ...state, courses: action.payload.map((c) => ({ ...c, id: uid() })) };
    case 'UPDATE_COURSE':
      return { ...state, courses: state.courses.map((c) => (c.id === action.payload.id ? { ...c, ...action.payload } : c)) };
    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter((c) => c.id !== action.payload) };

    // 习惯
    case 'SET_HABITS':
      return { ...state, habits: action.payload };
    case 'ADD_HABIT':
      return { ...state, habits: [...state.habits, { ...action.payload, id: uid(), createdAt: todayStr() }] };
    case 'UPDATE_HABIT':
      return { ...state, habits: state.habits.map((h) => (h.id === action.payload.id ? { ...h, ...action.payload } : h)) };
    case 'DELETE_HABIT':
      return { ...state, habits: state.habits.filter((h) => h.id !== action.payload) };
    case 'SET_HABIT_RECORDS':
      return { ...state, habitRecords: action.payload };
    case 'TOGGLE_HABIT_CHECKIN': {
      const { habitId, date } = action.payload;
      const records = { ...state.habitRecords };
      if (!records[habitId]) records[habitId] = {};
      records[habitId] = { ...records[habitId], [date]: !records[habitId][date] };
      return { ...state, habitRecords: records };
    }

    // 七计划（按周存：plans[mondayKey] = { longItems, urgentItems }）
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'ADD_PLAN_ITEM': {
      const { weekKey, kind, item } = action.payload; // kind: 'long' | 'urgent'
      const field = kind === 'urgent' ? 'urgentItems' : 'longItems';
      const wk = state.plans[weekKey] || { longItems: [], urgentItems: [] };
      const newItem = { id: uid(), text: item.text || '', done: false, linkedTaskId: item.linkedTaskId || null };
      return {
        ...state,
        plans: { ...state.plans, [weekKey]: { ...wk, [field]: [...(wk[field] || []), newItem] } },
      };
    }
    case 'TOGGLE_PLAN_ITEM': {
      const { weekKey, kind, id } = action.payload;
      const field = kind === 'urgent' ? 'urgentItems' : 'longItems';
      const wk = state.plans[weekKey];
      if (!wk) return state;
      return {
        ...state,
        plans: {
          ...state.plans,
          [weekKey]: { ...wk, [field]: wk[field].map((it) => (it.id === id ? { ...it, done: !it.done } : it)) },
        },
      };
    }
    case 'UPDATE_PLAN_ITEM': {
      const { weekKey, kind, id, text } = action.payload;
      const field = kind === 'urgent' ? 'urgentItems' : 'longItems';
      const wk = state.plans[weekKey];
      if (!wk) return state;
      return {
        ...state,
        plans: {
          ...state.plans,
          [weekKey]: { ...wk, [field]: wk[field].map((it) => (it.id === id ? { ...it, text } : it)) },
        },
      };
    }
    case 'DELETE_PLAN_ITEM': {
      const { weekKey, kind, id } = action.payload;
      const field = kind === 'urgent' ? 'urgentItems' : 'longItems';
      const wk = state.plans[weekKey];
      if (!wk) return state;
      return {
        ...state,
        plans: { ...state.plans, [weekKey]: { ...wk, [field]: wk[field].filter((it) => it.id !== id) } },
      };
    }

    // 设置
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    // 聊天
    case 'SET_CHAT':
      return { ...state, chatHistory: action.payload };
    case 'ADD_CHAT_MSG':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };

    default:
      return state;
  }
}

const initialState = {
  tasks: seedTasks,
  courses: seedCourses,
  habits: seedHabits,
  habitRecords: seedHabitRecords,
  plans: {},
  settings: DEFAULT_SETTINGS,
  chatHistory: [{ role: 'ai', text: '你好！我是 Life OS 助手\n\n试着问我：\n• 「今天有什么安排」\n• 「XX 做完了」帮你销账\n• 「帮我创建一个任务」' }],
};

// ---- Provider ----
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loaded, setLoaded] = React.useState(false);

  // 启动时从 AsyncStorage 加载
  useEffect(() => {
    (async () => {
      try {
        const [t, c, h, hr, s, ch, pl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.tasks),
          AsyncStorage.getItem(STORAGE_KEYS.courses),
          AsyncStorage.getItem(STORAGE_KEYS.habits),
          AsyncStorage.getItem(STORAGE_KEYS.habitRecords),
          AsyncStorage.getItem(STORAGE_KEYS.settings),
          AsyncStorage.getItem(STORAGE_KEYS.chatHistory),
          AsyncStorage.getItem(STORAGE_KEYS.plans),
        ]);
        if (t) dispatch({ type: 'SET_TASKS', payload: JSON.parse(t) });
        if (c) dispatch({ type: 'SET_COURSES', payload: JSON.parse(c) });
        if (h) dispatch({ type: 'SET_HABITS', payload: JSON.parse(h) });
        if (hr) dispatch({ type: 'SET_HABIT_RECORDS', payload: JSON.parse(hr) });
        if (s) dispatch({ type: 'SET_SETTINGS', payload: JSON.parse(s) });
        if (ch) dispatch({ type: 'SET_CHAT', payload: JSON.parse(ch) });
        if (pl) dispatch({ type: 'SET_PLANS', payload: JSON.parse(pl) });
      } catch (e) {
        console.warn('加载数据失败', e);
      }
      setLoaded(true);
    })();
  }, []);

  // 变更时自动保存
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks)).catch(() => {});
  }, [state.tasks, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(state.courses)).catch(() => {});
  }, [state.courses, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.habits, JSON.stringify(state.habits)).catch(() => {});
  }, [state.habits, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.habitRecords, JSON.stringify(state.habitRecords)).catch(() => {});
  }, [state.habitRecords, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings)).catch(() => {});
  }, [state.settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(state.chatHistory)).catch(() => {});
  }, [state.chatHistory, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(state.plans)).catch(() => {});
  }, [state.plans, loaded]);

  const value = React.useMemo(() => ({ state, dispatch, loaded }), [state, loaded]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
