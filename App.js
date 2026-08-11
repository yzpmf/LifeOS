// ============================================================
//  Life OS — 你的个人生活操作系统
//  四象限待办 · 课程表 · 每日打卡 · AI 助手
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View, TouchableOpacity, Text,
  StyleSheet, StatusBar, ActivityIndicator,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppProvider, useApp } from './src/store/AppContext';
import { FeedbackProvider } from './src/store/FeedbackContext';
import { todayStr } from './src/utils/helpers';
import { COLORS } from './src/constants';
import TabNav from './src/components/TabNav';
import AIChatSheet from './src/components/AIChatSheet';
import TodoScreen from './src/screens/TodoScreen';
import CourseScreen from './src/screens/CourseScreen';
import HabitScreen from './src/screens/HabitScreen';
import LearnScreen from './src/screens/LearnScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {
  requestNotificationPermission,
  scheduleTaskReminder,
  cancelNotificationsByTag,
  rescheduleAllNotifications,
} from './src/utils/notifications';

const FAB_SIZE = 56;

// 可拖拽的 AI 浮动按钮：拖动改位置，轻点打开对话
function DraggableAIButton({ insets, onPress, initialPos, onPosChange }) {
  const { width, height } = Dimensions.get('window');
  const MARGIN = 8;

  const clamp = (x, y) => ({
    x: Math.min(Math.max(x, MARGIN), width - FAB_SIZE - MARGIN),
    y: Math.min(Math.max(y, insets.top + MARGIN), height - FAB_SIZE - insets.bottom - MARGIN),
  });

  // 默认位置：右下角（与旧版一致）
  const defaultPos = clamp(width - FAB_SIZE - 18, height - FAB_SIZE - 90 - insets.bottom);
  const startPos = initialPos && typeof initialPos.x === 'number' ? clamp(initialPos.x, initialPos.y) : defaultPos;

  const pan = useRef(new Animated.ValueXY(startPos)).current;
  const moved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        moved.current = false;
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true;
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const c = clamp(pan.x._value, pan.y._value);
        Animated.spring(pan, { toValue: c, useNativeDriver: false, friction: 7 }).start();
        if (moved.current) {
          onPosChange(c);
        } else {
          onPress();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.aiFab, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <Feather name="message-circle" size={26} color="#fff" />
    </Animated.View>
  );
}

function AppContent() {
  const { state, dispatch, loaded } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('todo');
  const [aiOpen, setAiOpen] = useState(false);
  const prevTasksRef = useRef(null);
  const notifInitialized = useRef(false);

  // 请求通知权限 & 首次调度
  useEffect(() => {
    if (loaded && !notifInitialized.current) {
      notifInitialized.current = true;
      requestNotificationPermission().then((granted) => {
        if (granted) {
          rescheduleAllNotifications(state.tasks, state.courses, state.habits, state.settings);
        }
      });
    }
  }, [loaded]);

  // 任务变更时更新通知
  useEffect(() => {
    if (!loaded || !state.settings.notificationsEnabled) return;
    const prev = prevTasksRef.current;
    prevTasksRef.current = state.tasks;

    if (!prev) return; // 首次加载，跳过

    // 找出新完成或删除的任务，取消其通知
    for (const task of state.tasks) {
      const prevTask = prev.find((t) => t.id === task.id);
      if (prevTask && !prevTask.done && task.done) {
        cancelNotificationsByTag(`task-${task.id}`);
      }
      if (prevTask && !prevTask.deleted && task.deleted) {
        cancelNotificationsByTag(`task-${task.id}`);
      }
    }

    // 为新增或更新的任务设置提醒
    for (const task of state.tasks) {
      if (task.done || task.deleted) continue;
      const prevTask = prev.find((t) => t.id === task.id);
      if (!prevTask || prevTask.ddl !== task.ddl) {
        scheduleTaskReminder(task);
      }
    }
  }, [state.tasks, loaded]);

  const handleCompleteTask = (id) => {
    dispatch({ type: 'TOGGLE_TASK', payload: id });
  };

  const handleCheckinHabit = (habitId) => {
    dispatch({ type: 'TOGGLE_HABIT_CHECKIN', payload: { habitId, date: todayStr() } });
  };

  const handleCreateTask = (data) => {
    dispatch({ type: 'ADD_TASK', payload: data });
  };

  const handleImportCourses = (list) => {
    // 导入课程表时整表替换：清空旧课程，换成本次识别的结果
    if (list && list.length) dispatch({ type: 'REPLACE_COURSES', payload: list });
  };

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* 内容区 */}
      <View style={styles.content}>
        {tab === 'todo' && <TodoScreen />}
        {tab === 'course' && <CourseScreen />}
        {tab === 'habit' && <HabitScreen />}
        {tab === 'learn' && <LearnScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      {/* AI 浮动按钮（可拖拽） */}
      <DraggableAIButton
        insets={insets}
        onPress={() => setAiOpen(true)}
        initialPos={state.settings.aiFabPos}
        onPosChange={(pos) => dispatch({ type: 'SET_SETTINGS', payload: { aiFabPos: pos } })}
      />

      {/* 底部 Tab */}
      <TabNav active={tab} onTabChange={setTab} />

      {/* AI 对话 */}
      <AIChatSheet
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        tasks={state.tasks}
        habits={state.habits}
        habitRecords={state.habitRecords}
        courses={state.courses}
        diary={state.diary}
        insights={state.insights}
        settings={state.settings}
        onCompleteTask={handleCompleteTask}
        onCheckinHabit={handleCheckinHabit}
        onCreateTask={handleCreateTask}
        onImportCourses={handleImportCourses}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppProvider>
        <FeedbackProvider>
          <AppContent />
        </FeedbackProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.sub,
  },
  aiFab: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 12px rgba(224,90,51,0.35)',
    elevation: 8,
  },
  aiFabIcon: {
    fontSize: 24,
  },
});
