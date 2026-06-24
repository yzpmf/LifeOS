// ============================================================
//  Life OS — 课程表页面
// ============================================================
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, WEEKDAYS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import { todayWeekday, getCurrentWeek, isCourseOnDay, fmtDate } from '../utils/helpers';
import AddCourseSheet from '../components/AddCourseSheet';

export default function CourseScreen() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { courses, settings } = state;
  const todayDow = todayWeekday();
  const currentWeek = getCurrentWeek(settings.semesterStart);

  const [adding, setAdding] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayDow);

  const handleSave = (data) => {
    if (data.id) {
      dispatch({ type: 'UPDATE_COURSE', payload: data });
    } else {
      dispatch({ type: 'ADD_COURSE', payload: data });
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: '删除课程',
      message: '确定删除这门课程？',
      confirmText: '删除',
      destructive: true,
    });
    if (ok) {
      dispatch({ type: 'DELETE_COURSE', payload: id });
      showToast('已删除课程', 'success');
    }
  };

  // 按天分组课程（含周次过滤）
  const coursesByDay = useMemo(() => {
    const grouped = {};
    for (let d = 1; d <= 7; d++) {
      grouped[d] = courses
        .filter((c) => isCourseOnDay(c, d, currentWeek))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grouped;
  }, [courses, currentWeek]);

  const selectedCourses = coursesByDay[selectedDay] || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>课程表</Text>
            <Text style={styles.subtitle}>{WEEKDAYS[todayDow === 7 ? 0 : todayDow]} · {currentWeek ? `第 ${currentWeek} 周` : '未设置学期'}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditCourse(null); setAdding(true); }} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>＋ 添加</Text>
          </TouchableOpacity>
        </View>

        {/* 星期切换 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabsScroll}>
          <View style={styles.dayTabs}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const isToday = d === todayDow;
              const isActive = d === selectedDay;
              const count = (coursesByDay[d] || []).length;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayTab, isActive && styles.dayTabActive, isToday && !isActive && styles.dayTabToday]}
                  onPress={() => setSelectedDay(d)}
                >
                  <Text style={[styles.dayTabLabel, isActive && styles.dayTabLabelActive]}>
                    {WEEKDAYS[d === 7 ? 0 : d]}
                  </Text>
                  {isToday && <View style={styles.todayDot} />}
                  {count > 0 && (
                    <Text style={[styles.dayTabCount, isActive && styles.dayTabCountActive]}>{count}节</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* 课程列表 */}
        <View style={styles.courseList}>
          {selectedCourses.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{WEEKDAYS[selectedDay === 7 ? 0 : selectedDay]}没有课程</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setEditCourse(null); setAdding(true); }}>
                <Text style={styles.emptyBtnText}>添加课程</Text>
              </TouchableOpacity>
            </View>
          ) : (
            selectedCourses.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.courseCard}
                onPress={() => { setEditCourse(c); setAdding(true); }}
                onLongPress={() => handleDelete(c.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.colorBar, { backgroundColor: c.color }]} />
                <View style={styles.courseContent}>
                  <View style={styles.courseHeader}>
                    <View style={styles.courseTitleRow}>
                      <Text style={styles.courseName}>{c.title}</Text>
                      {c.temporary && (
                        <View style={styles.tempBadge}>
                          <Text style={styles.tempBadgeText}>临时</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.timeTag, { backgroundColor: c.color + '15' }]}>
                      <Text style={[styles.timeTagText, { color: c.color }]}>{c.startTime} - {c.endTime}</Text>
                    </View>
                  </View>
                  <View style={styles.courseMeta}>
                    {c.temporary && c.date ? <Text style={styles.courseMetaText}>{fmtDate(c.date)}</Text> : null}
                    {c.teacher ? <Text style={styles.courseMetaText}>{c.teacher}</Text> : null}
                    {c.location ? <Text style={styles.courseMetaText}>{c.location}</Text> : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* 全周概览 */}
        <View style={styles.weekOverview}>
          <Text style={styles.weekOverviewTitle}>全周概览</Text>
          <View style={styles.weekStats}>
            {(() => {
              const counts = [1, 2, 3, 4, 5, 6, 7].map((d) => (coursesByDay[d] || []).length);
              const maxCount = Math.max(1, ...counts); // 按当周最大节数等比缩放，避免柱子溢出盖住标题
              return [1, 2, 3, 4, 5, 6, 7].map((d, i) => {
                const count = counts[i];
                const isToday = d === todayDow;
                const barH = Math.round((count / maxCount) * 56) + 4;
                return (
                  <View key={d} style={styles.weekStatCol}>
                    <View style={[styles.weekStatBar, { height: barH, backgroundColor: isToday ? COLORS.accent : COLORS.line }]} />
                    <Text style={[styles.weekStatLabel, isToday && { color: COLORS.accent, fontWeight: '700' }]}>
                      {WEEKDAYS[d === 7 ? 0 : d].slice(1)}
                    </Text>
                    <Text style={styles.weekStatCount}>{count}</Text>
                  </View>
                );
              });
            })()}
          </View>
        </View>
      </ScrollView>

      <AddCourseSheet
        visible={adding}
        onClose={() => { setAdding(false); setEditCourse(null); }}
        onSave={handleSave}
        editCourse={editCourse}
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
  dayTabsScroll: { marginBottom: 16 },
  dayTabs: { flexDirection: 'row', gap: 6 },
  dayTab: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line,
    alignItems: 'center', minWidth: 48,
  },
  dayTabActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dayTabToday: { borderColor: COLORS.accent + '60' },
  dayTabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.sub },
  dayTabLabelActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 3 },
  dayTabCount: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  dayTabCountActive: { color: '#fff' + 'CC' },
  courseList: { gap: 10 },
  emptyBox: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line,
    padding: 32, alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.sub, marginBottom: 12 },
  emptyBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  courseCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden',
  },
  colorBar: { width: 5 },
  courseContent: { flex: 1, padding: 14 },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  courseName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  tempBadge: { backgroundColor: COLORS.warning + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tempBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  timeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timeTagText: { fontSize: 11, fontWeight: '700' },
  courseMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  courseMetaText: { fontSize: 12, color: COLORS.sub },
  weekOverview: {
    marginTop: 24, backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, padding: 16,
  },
  weekOverviewTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  weekStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 96 },
  weekStatCol: { alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: 96 },
  weekStatBar: { width: 24, borderRadius: 4, minHeight: 4 },
  weekStatLabel: { fontSize: 10, color: COLORS.muted },
  weekStatCount: { fontSize: 10, color: COLORS.muted },
});
