// ============================================================
//  Life OS — 每日打卡页面
// ============================================================
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import { todayStr, calcStreak, fmtYMD, isHabitActiveOnDate } from '../utils/helpers';
import AddHabitSheet from '../components/AddHabitSheet';

export default function HabitScreen() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { habits, habitRecords } = state;

  const [adding, setAdding] = useState(false);
  const [editHabit, setEditHabit] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const today = todayStr();

  // 今日应打卡的习惯（按 repeatRule 过滤）
  const activeHabitsToday = useMemo(() => habits.filter((h) => isHabitActiveOnDate(h, today)), [habits, today]);

  // 展示列表：默认只显示今天应打卡的
  const displayHabits = showAll ? habits : activeHabitsToday;

  const handleSave = (data) => {
    if (data.id) {
      dispatch({ type: 'UPDATE_HABIT', payload: data });
    } else {
      dispatch({ type: 'ADD_HABIT', payload: data });
    }
  };

  const handleCheckin = (habitId) => {
    dispatch({ type: 'TOGGLE_HABIT_CHECKIN', payload: { habitId, date: today } });
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: '删除习惯',
      message: `确定删除「${name}」？打卡记录也会被清除。`,
      confirmText: '删除',
      destructive: true,
    });
    if (ok) {
      dispatch({ type: 'DELETE_HABIT', payload: id });
      showToast('已删除习惯', 'success');
    }
  };

  // 统计：只统计今天应打卡的
  const checkedToday = activeHabitsToday.filter((h) => habitRecords[h.id] && habitRecords[h.id][today]).length;
  const totalCount = activeHabitsToday.length;
  const completionRate = totalCount ? Math.round((checkedToday / totalCount) * 100) : 0;

  // 最近7天热力数据：每天只统计当天应打卡的习惯
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(fmtYMD(d));
    }
    return days;
  }, []);

  // 今天没打卡的习惯数量
  const undoneToday = totalCount - checkedToday;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>每日打卡</Text>
            <Text style={styles.subtitle}>到点提醒 · 连续坚持</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditHabit(null); setAdding(true); }} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        </View>

        {/* 今日进度 */}
        <View style={styles.progressCard}>
          <View style={styles.progressLeft}>
            <Text style={styles.progressTitle}>今日打卡</Text>
            <Text style={styles.progressValue}>
              <Text style={{ color: COLORS.accent }}>{checkedToday}</Text> / {totalCount}
            </Text>
            {undoneToday > 0 && (
              <Text style={styles.progressHint}>{undoneToday} 项待打卡</Text>
            )}
            {totalCount === 0 && (
              <Text style={styles.progressHint}>今天休息日</Text>
            )}
          </View>
          <View style={styles.progressRight}>
            <View style={styles.ringOuter}>
              <View style={styles.ringInner}>
                <Text style={styles.ringText}>{totalCount ? `${completionRate}%` : '--'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 近7天热力图 */}
        <View style={styles.heatmapCard}>
          <Text style={styles.heatmapTitle}>📅 近 7 天</Text>
          <View style={styles.heatmapRow}>
            {last7Days.map((d) => {
              const dayHabits = habits.filter((h) => isHabitActiveOnDate(h, d));
              const count = dayHabits.filter((h) => habitRecords[h.id] && habitRecords[h.id][d]).length;
              const ratio = dayHabits.length ? count / dayHabits.length : 0;
              const isToday = d === today;
              return (
                <View key={d} style={styles.heatmapCol}>
                  <View
                    style={[
                      styles.heatmapDot,
                      {
                        backgroundColor:
                          ratio === 0 ? COLORS.line :
                          ratio < 0.5 ? COLORS.success + '40' :
                          ratio < 1 ? COLORS.success + '80' :
                          COLORS.success,
                      },
                      isToday && styles.heatmapDotToday,
                    ]}
                  />
                  <Text style={[styles.heatmapLabel, isToday && { color: COLORS.accent, fontWeight: '700' }]}>
                    {d.slice(8)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 习惯列表 */}
        <View style={styles.habitList}>
          {habits.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyText}>还没有习惯</Text>
              <Text style={styles.emptyHint}>创建一个习惯，开始养成好习惯吧</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setEditHabit(null); setAdding(true); }}>
                <Text style={styles.emptyBtnText}>创建习惯</Text>
              </TouchableOpacity>
            </View>
          ) : displayHabits.length === 0 && !showAll ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>今天没有需要打卡的习惯</Text>
              <Text style={styles.emptyHint}>休息一下，或者查看全部习惯</Text>
            </View>
          ) : (
            displayHabits.map((h) => {
              const isActiveToday = isHabitActiveOnDate(h, today);
              const isChecked = habitRecords[h.id] && habitRecords[h.id][today];
              const streak = calcStreak(habitRecords, h.id);
              // 不在今天应打卡列表里，且当前是「查看全部」模式
              const isResting = showAll && !isActiveToday;
              return (
                <View key={h.id} style={[
                  styles.habitCard,
                  isChecked && !isResting && styles.habitCardDone,
                  isResting && styles.habitCardRest,
                ]}>
                  <TouchableOpacity
                    style={styles.habitMain}
                    onPress={() => { if (!isResting) handleCheckin(h.id); }}
                    onLongPress={() => handleDelete(h.id, h.name)}
                    activeOpacity={isResting ? 1 : 0.7}
                    disabled={isResting}
                  >
                    <View style={[
                      styles.checkCircle,
                      isChecked && { backgroundColor: COLORS.success, borderColor: COLORS.success },
                      isResting && styles.checkCircleRest,
                    ]}>
                      {isChecked && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <View style={styles.habitInfo}>
                      <View style={styles.habitNameRow}>
                        <Text style={[styles.habitName, isChecked && styles.habitNameDone, isResting && styles.habitNameRest]}>
                          {h.icon} {h.name}
                        </Text>
                        {isResting && <Text style={styles.restBadge}>休息</Text>}
                      </View>
                      <View style={styles.habitMeta}>
                        {h.time ? <Text style={styles.habitTime}>⏰ {h.time}</Text> : null}
                        <Text style={styles.habitRepeat}>{h.repeatRule}
                          {h.repeatRule === '自定义' && Array.isArray(h.customDays) && h.customDays.length > 0
                            ? ` · ${h.customDays.map((wd) => ['日', '一', '二', '三', '四', '五', '六'][wd === 7 ? 0 : wd]).join('')}`
                            : ''}
                        </Text>
                      </View>
                    </View>
                    {!isResting && (
                      <View style={styles.streakBox}>
                        <Text style={styles.streakNum}>{streak}</Text>
                        <Text style={styles.streakLabel}>天连续</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editHabitBtn}
                    onPress={() => { setEditHabit(h); setAdding(true); }}
                  >
                    <Text style={styles.editHabitText}>编辑</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* 查看全部 / 收起 */}
        {habits.length > 0 && (
          <TouchableOpacity
            style={styles.showAllBtn}
            onPress={() => setShowAll(!showAll)}
            activeOpacity={0.7}
          >
            <Text style={styles.showAllText}>
              {showAll ? '收起 · 只看今天的' : `查看全部习惯（${habits.length} 项）`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AddHabitSheet
        visible={adding}
        onClose={() => { setAdding(false); setEditHabit(null); }}
        onSave={handleSave}
        editHabit={editHabit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  progressCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, padding: 18, marginBottom: 12,
  },
  progressLeft: { flex: 1, justifyContent: 'center' },
  progressTitle: { fontSize: 13, color: COLORS.sub },
  progressValue: { fontSize: 28, fontWeight: '800', color: COLORS.ink, marginTop: 4 },
  progressHint: { fontSize: 12, color: COLORS.accent, marginTop: 2 },
  progressRight: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 4,
    borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center',
  },
  ringInner: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  ringText: { fontSize: 14, fontWeight: '800', color: COLORS.accent },

  heatmapCard: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line,
    padding: 16, marginBottom: 16,
  },
  heatmapTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  heatmapRow: { flexDirection: 'row', justifyContent: 'space-around' },
  heatmapCol: { alignItems: 'center', gap: 6 },
  heatmapDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.line },
  heatmapDotToday: { borderWidth: 2, borderColor: COLORS.accent },
  heatmapLabel: { fontSize: 10, color: COLORS.muted },

  habitList: { gap: 10 },
  emptyBox: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line,
    padding: 36, alignItems: 'center',
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  emptyHint: { fontSize: 12, color: COLORS.muted, marginTop: 4, marginBottom: 16 },
  emptyBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  habitCard: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  habitCardDone: { backgroundColor: COLORS.success + '08', borderColor: COLORS.success + '30' },
  habitCardRest: { opacity: 0.45, backgroundColor: COLORS.card },
  habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.line,
    backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center',
  },
  checkCircleRest: { borderColor: COLORS.line, borderStyle: 'dashed', opacity: 0.5 },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 18 },
  habitInfo: { flex: 1 },
  habitNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  habitName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  habitNameDone: { color: COLORS.success },
  habitNameRest: { color: COLORS.muted },
  restBadge: {
    fontSize: 9, color: COLORS.muted, backgroundColor: COLORS.line,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
  },
  habitMeta: { flexDirection: 'row', gap: 10, marginTop: 4 },
  habitTime: { fontSize: 11, color: COLORS.muted },
  habitRepeat: { fontSize: 11, color: COLORS.muted },
  streakBox: { alignItems: 'center' },
  streakNum: { fontSize: 20, fontWeight: '800', color: COLORS.accent },
  streakLabel: { fontSize: 9, color: COLORS.muted },
  editHabitBtn: { paddingHorizontal: 14, paddingVertical: 20, borderLeftWidth: 1, borderLeftColor: COLORS.line },
  editHabitText: { fontSize: 12, color: COLORS.muted },

  showAllBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card,
  },
  showAllText: { fontSize: 13, color: COLORS.sub, fontWeight: '600' },
});
