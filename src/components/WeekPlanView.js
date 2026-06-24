// ============================================================
//  Life OS — 七计划（仿「一五计划」：每七天一个计划单元）
//  长期任务的最小解决单元 + 紧急任务的本周安排，全部用户手写
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, QUADRANTS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import {
  mondayKey, planTitle, weekRangeLabel, shiftDays,
  todayWeekday, quadrantOf, fmtDDL,
} from '../utils/helpers';

const EMPTY_WEEK = { longItems: [], urgentItems: [] };

export default function WeekPlanView() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { plans, settings, tasks } = state;
  const threshold = settings.threshold || 7;

  const thisWeekKey = mondayKey(new Date());
  const [weekKey, setWeekKey] = useState(thisWeekKey);

  const plan = plans[weekKey] || EMPTY_WEEK;
  const title = planTitle(weekKey, settings.planAnchorMonday);
  const isThisWeek = weekKey === thisWeekKey;
  const isEmpty = plan.longItems.length === 0 && plan.urgentItems.length === 0;

  // 输入状态
  const [longText, setLongText] = useState('');
  const [urgentText, setUrgentText] = useState('');
  const [longLink, setLongLink] = useState(null);
  const [urgentLink, setUrgentLink] = useState(null);
  const [picker, setPicker] = useState(null); // 'long' | 'urgent' | null

  // 切换周时清空未提交的输入与关联，避免内容串到别的周
  useEffect(() => {
    setLongText(''); setUrgentText(''); setLongLink(null); setUrgentLink(null);
  }, [weekKey]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.done && !t.deleted),
    [tasks]
  );

  const taskById = (id) => tasks.find((t) => t.id === id) || null;

  // 周日(7)或周一(1)且本周计划为空 → 提醒
  const showReminder = isThisWeek && isEmpty && [1, 7].includes(todayWeekday());

  // 确保锚点（连续编号的起点）已设置，且不晚于当前操作的周
  const ensureAnchor = () => {
    const anchor = settings.planAnchorMonday;
    if (!anchor || weekKey < anchor) {
      dispatch({ type: 'SET_SETTINGS', payload: { planAnchorMonday: weekKey } });
    }
  };

  const addItem = (kind) => {
    const text = kind === 'long' ? longText : urgentText;
    const link = kind === 'long' ? longLink : urgentLink;
    if (!text.trim() && !link) return;
    ensureAnchor();
    dispatch({
      type: 'ADD_PLAN_ITEM',
      payload: { weekKey, kind, item: { text: text.trim(), linkedTaskId: link ? link.id : null } },
    });
    if (kind === 'long') { setLongText(''); setLongLink(null); }
    else { setUrgentText(''); setUrgentLink(null); }
  };

  const toggleItem = (kind, id) => dispatch({ type: 'TOGGLE_PLAN_ITEM', payload: { weekKey, kind, id } });

  const deleteItem = async (kind, id) => {
    const ok = await confirm({ title: '删除计划项', message: '确定删除这一条？', confirmText: '删除', destructive: true });
    if (ok) {
      dispatch({ type: 'DELETE_PLAN_ITEM', payload: { weekKey, kind, id } });
      showToast('已删除', 'success');
    }
  };

  const pickTask = (task) => {
    if (picker === 'long') setLongLink(task);
    else if (picker === 'urgent') setUrgentLink(task);
    setPicker(null);
  };

  // ---- 单条计划项 ----
  const renderItem = (item, kind) => {
    const linked = item.linkedTaskId ? taskById(item.linkedTaskId) : null;
    const main = item.text || (linked ? linked.title : '');
    const sub = item.text && linked ? linked.title : null;
    return (
      <View key={item.id} style={styles.item}>
        <TouchableOpacity style={styles.checkArea} onPress={() => toggleItem(kind, item.id)} activeOpacity={0.7}>
          <View style={[styles.checkbox, item.done && styles.checkboxOn]}>
            {item.done && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            {sub && <Text style={styles.itemLink}>{sub}</Text>}
            <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
              {main}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.delBtn} onPress={() => deleteItem(kind, item.id)} hitSlop={8}>
          <Text style={styles.delBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ---- 某一栏（长期 / 紧急）----
  const renderColumn = (kind, meta) => {
    const items = kind === 'long' ? plan.longItems : plan.urgentItems;
    const text = kind === 'long' ? longText : urgentText;
    const setText = kind === 'long' ? setLongText : setUrgentText;
    const link = kind === 'long' ? longLink : urgentLink;
    const setLink = kind === 'long' ? setLongLink : setUrgentLink;
    const done = items.filter((i) => i.done).length;

    return (
      <View style={[styles.column, { borderColor: meta.color + '40' }]}>
        <View style={styles.columnHeader}>
          <Text style={[styles.columnTitle, { color: meta.color }]}>{meta.title}</Text>
          {items.length > 0 && <Text style={styles.columnCount}>{done}/{items.length}</Text>}
        </View>
        <Text style={styles.columnHint}>{meta.hint}</Text>

        {items.length === 0 ? (
          <Text style={styles.colEmpty}>还没有，写一条本周要做的吧</Text>
        ) : (
          <View style={styles.itemList}>{items.map((it) => renderItem(it, kind))}</View>
        )}

        {/* 关联任务 chip */}
        {link && (
          <View style={styles.linkChip}>
            <Text style={styles.linkChipText} numberOfLines={1}>{link.title}</Text>
            <TouchableOpacity onPress={() => setLink(null)} hitSlop={8}>
              <Text style={styles.linkChipX}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 输入行 */}
        <View style={styles.addRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setPicker(kind)} activeOpacity={0.7}>
            <Feather name="link-2" size={16} color={COLORS.sub} />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => addItem(kind)}
            placeholder={link ? '补充这周要推进到哪一步…' : meta.placeholder}
            placeholderTextColor={COLORS.muted}
            style={styles.addInput}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: meta.color }, (!text.trim() && !link) && styles.addBtnDisabled]}
            onPress={() => addItem(kind)}
            disabled={!text.trim() && !link}
          >
            <Text style={styles.addBtnText}>添加</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View>
      {/* 周切换头 */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setWeekKey(shiftDays(weekKey, -7))} hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.weekCenter}>
          <View style={styles.weekTitleRow}>
            <Text style={styles.weekTitle}>{title}</Text>
            {isThisWeek && <View style={styles.nowDot}><Text style={styles.nowDotText}>本周</Text></View>}
          </View>
          <Text style={styles.weekRange}>{weekRangeLabel(weekKey)}</Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => setWeekKey(shiftDays(weekKey, 7))} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {!isThisWeek && (
        <TouchableOpacity style={styles.backToNow} onPress={() => setWeekKey(thisWeekKey)}>
          <Text style={styles.backToNowText}>回到本周</Text>
        </TouchableOpacity>
      )}

      {showReminder && (
        <View style={styles.reminder}>
          <Text style={styles.reminderText}>新的一周开始了，给自己定一个《{title}》吧——把长期任务拆成这周能推进的一小步，再排好这周的紧急事项。</Text>
        </View>
      )}

      {renderColumn('long', {
        title: '长期任务 · 本周推进', color: COLORS.q2,
        hint: '把大目标拆成「这一周能完成的最小一步」',
        placeholder: '例如：保研材料 — 写完个人陈述初稿',
      })}

      {renderColumn('urgent', {
        title: '紧急任务 · 本周安排', color: COLORS.q1,
        hint: '这周必须处理的急事，安排好哪天做',
        placeholder: '例如：周三前交数据库作业',
      })}

      <Text style={styles.footHint}>本周计划是你自己写的「最小行动清单」——每周日或周一花几分钟，给下一个七天定个调。</Text>

      {/* 关联任务选择器 */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>关联一个进行中的任务</Text>
            {activeTasks.length === 0 ? (
              <Text style={styles.pickerEmpty}>暂无进行中的任务</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {activeTasks.map((t) => {
                  const q = QUADRANTS[quadrantOf(t, threshold)];
                  return (
                    <TouchableOpacity key={t.id} style={styles.pickerItem} onPress={() => pickTask(t)}>
                      <View style={[styles.pickerDot, { backgroundColor: q.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemTitle} numberOfLines={1}>{t.title}</Text>
                        <Text style={styles.pickerItemMeta}>{q.name} · {fmtDDL(t.ddl)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setPicker(null)}>
              <Text style={styles.pickerCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 22, color: COLORS.sub, fontWeight: '700', lineHeight: 24 },
  weekCenter: { flex: 1, alignItems: 'center' },
  weekTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  nowDot: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  nowDotText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  weekRange: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  backToNow: { alignSelf: 'center', marginBottom: 10 },
  backToNowText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  reminder: { backgroundColor: COLORS.accentSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  reminderText: { fontSize: 13, color: COLORS.accent, lineHeight: 19 },

  column: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  columnTitle: { fontSize: 15, fontWeight: '800' },
  columnCount: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  columnHint: { fontSize: 11, color: COLORS.muted, marginTop: 2, marginBottom: 10 },
  colEmpty: { fontSize: 13, color: COLORS.muted, paddingVertical: 8 },
  itemList: { gap: 8, marginBottom: 4 },

  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemLink: { fontSize: 11, color: COLORS.accent, marginBottom: 1 },
  itemText: { fontSize: 14, color: COLORS.ink, lineHeight: 20 },
  itemTextDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  delBtn: { padding: 4 },
  delBtnText: { fontSize: 13, color: COLORS.muted },

  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accentSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  linkChipText: { flex: 1, fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  linkChipX: { fontSize: 12, color: COLORS.accent },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  linkBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { fontSize: 16 },
  addInput: { flex: 1, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: COLORS.ink },
  addBtn: { borderRadius: 10, paddingHorizontal: 14, height: 38, justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  footHint: { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginTop: 2 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pickerSheet: { backgroundColor: COLORS.bg, borderRadius: 20, padding: 18, width: '100%' },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 12 },
  pickerEmpty: { fontSize: 13, color: COLORS.muted, paddingVertical: 16, textAlign: 'center' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerItemTitle: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  pickerItemMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  pickerCancel: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  pickerCancelText: { fontSize: 14, color: COLORS.sub, fontWeight: '600' },
});
