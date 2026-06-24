// ============================================================
//  Life OS — 四象限待办页面
// ============================================================
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import { groupByQuadrant, daysLeft, fmtDate } from '../utils/helpers';
import QuadrantGrid from '../components/QuadrantGrid';
import AddTaskSheet from '../components/AddTaskSheet';
import TaskDetailSheet from '../components/TaskDetailSheet';
import WeekPlanView from '../components/WeekPlanView';

export default function TodoScreen() {
  const { state, dispatch } = useApp();
  const { showToast } = useFeedback();
  const { tasks, settings } = state;
  const threshold = settings.threshold || 7;

  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [showDone, setShowDone] = useState(false);

  const activeTasks = useMemo(() => tasks.filter((t) => !t.done && !t.deleted), [tasks]);
  const groups = useMemo(() => groupByQuadrant(activeTasks, threshold), [activeTasks, threshold]);
  const openTask = tasks.find((t) => t.id === openId) || null;

  // 统计
  const overdueCount = activeTasks.filter((t) => daysLeft(t.ddl) !== null && daysLeft(t.ddl) < 0).length;
  const q1Count = groups.Q1.length;

  const handleSave = (data) => {
    if (data.id) {
      dispatch({ type: 'UPDATE_TASK', payload: data });
    } else {
      dispatch({ type: 'ADD_TASK', payload: data });
    }
  };

  const handleAddSub = (text) => {
    if (!openId) return;
    dispatch({ type: 'ADD_SUB', payload: { tid: openId, text } });
  };

  const handleToggleSub = (sid) => {
    if (!openId) return;
    dispatch({ type: 'TOGGLE_SUB', payload: { tid: openId, sid } });
  };

  const handleDeleteSub = (sid) => {
    if (!openId) return;
    dispatch({ type: 'DELETE_SUB', payload: { tid: openId, sid } });
  };

  const handleComplete = () => {
    if (!openId) return;
    dispatch({ type: 'TOGGLE_TASK', payload: openId });
  };

  const handleUpdate = (data) => {
    dispatch({ type: 'UPDATE_TASK', payload: data });
  };

  const handleDelete = () => {
    if (!openId) return;
    const id = openId;
    dispatch({ type: 'DELETE_TASK', payload: id });
    setOpenId(null);
    showToast('已删除任务', 'success', {
      label: '撤销',
      onPress: () => dispatch({ type: 'UPDATE_TASK', payload: { id, deleted: false } }),
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>我的待办</Text>
            <Text style={styles.subtitle}>DDL 自动归类 · 你只需标紧急</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        </View>

        {/* 视图切换 */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
            onPress={() => setViewMode('grid')}
          >
            <Text style={[styles.viewBtnText, viewMode === 'grid' && styles.viewBtnTextActive]}>任务总览</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'plan' && styles.viewBtnActive]}
            onPress={() => setViewMode('plan')}
          >
            <Text style={[styles.viewBtnText, viewMode === 'plan' && styles.viewBtnTextActive]}>本周计划</Text>
          </TouchableOpacity>
        </View>

        {/* 摘要条（仅四象限） */}
        {viewMode === 'grid' && activeTasks.length > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              共 {activeTasks.length} 项任务
              {q1Count > 0 && <Text style={{ color: COLORS.danger }}> · {q1Count} 项紧急</Text>}
              {overdueCount > 0 && <Text style={{ color: COLORS.danger }}> · {overdueCount} 项逾期</Text>}
            </Text>
          </View>
        )}

        {/* 四象限 / 七计划 */}
        {viewMode === 'grid' ? (
          <QuadrantGrid groups={groups} threshold={threshold} onOpenTask={setOpenId} />
        ) : (
          <WeekPlanView />
        )}

        {/* 提示（仅四象限） */}
        {viewMode === 'grid' && (
          <Text style={styles.hint}>
            剩余 ≤ {threshold} 天的任务自动归入「短期」象限。标记紧急后进入「马上做」。
          </Text>
        )}

        {/* 已完成列表（仅四象限） */}
        {viewMode === 'grid' && tasks.filter((t) => t.done && !t.deleted).length > 0 && (
          <View style={styles.doneSection}>
            <TouchableOpacity
              style={styles.doneSectionHeader}
              onPress={() => setShowDone(!showDone)}
              activeOpacity={0.7}
            >
              <Text style={styles.doneSectionTitle}>
                已完成 ({tasks.filter((t) => t.done && !t.deleted).length})
              </Text>
              <Text style={styles.doneToggle}>{showDone ? '收起' : '展开'}</Text>
            </TouchableOpacity>
            {showDone && (
              <View style={styles.doneList}>
                {tasks.filter((t) => t.done && !t.deleted).map((t) => (
                  <View key={t.id} style={styles.doneItem}>
                    <View style={styles.doneItemLeft}>
                      <Text style={styles.doneItemTitle}>{t.title}</Text>
                      <Text style={styles.doneItemTime}>
                        {t.completedAt ? `完成于 ${fmtDate(t.completedAt)}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.undoBtn}
                      onPress={() => dispatch({ type: 'TOGGLE_TASK', payload: t.id })}
                    >
                      <Text style={styles.undoBtnText}>撤销</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 新建任务 */}
      <AddTaskSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={handleSave}
        threshold={threshold}
      />

      {/* 任务详情（设置 + 实现步骤 合并编辑） */}
      <TaskDetailSheet
        visible={!!openTask}
        task={openTask}
        threshold={threshold}
        onClose={() => setOpenId(null)}
        onUpdate={handleUpdate}
        onToggleSub={handleToggleSub}
        onAddSub={handleAddSub}
        onDeleteSub={handleDeleteSub}
        onComplete={handleComplete}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  viewToggle: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line, padding: 3, marginBottom: 14,
  },
  viewBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center',
  },
  viewBtnActive: { backgroundColor: COLORS.accent },
  viewBtnText: { fontSize: 13, color: COLORS.sub, fontWeight: '600' },
  viewBtnTextActive: { color: '#fff', fontWeight: '700' },
  summaryBar: {
    backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  summaryText: { fontSize: 13, color: COLORS.sub },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 14, lineHeight: 18 },
  doneSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.line },
  doneSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.sub },
  doneToggle: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  doneList: { marginTop: 10, gap: 8 },
  doneItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 12,
  },
  doneItemLeft: { flex: 1 },
  doneItemTitle: { fontSize: 14, color: COLORS.muted, textDecorationLine: 'line-through' },
  doneItemTime: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  undoBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card,
  },
  undoBtnText: { fontSize: 12, color: COLORS.sub, fontWeight: '600' },
});
