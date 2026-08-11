// ============================================================
//  Life OS — 任务详情弹窗（设置 + 实现步骤 合并在一处）
//  标题 / 截止 / 紧急 / 备注 与「实现步骤」清单同屏编辑，
//  修改即时保存，无需再跳到单独的编辑弹窗。
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, Switch, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import DatePickerChip from './DatePickerChip';
import { COLORS, QUADRANTS } from '../constants';
import { quadrantOf, fmtDDL, isOverdue } from '../utils/helpers';

export default function TaskDetailSheet({
  visible, task, threshold, onClose, onUpdate,
  onToggleSub, onAddSub, onDeleteSub, onComplete, onDelete,
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [ddl, setDdl] = useState(null);
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState('');
  const [stepText, setStepText] = useState('');

  // 打开任务（或切换任务）时，用任务数据初始化本地表单
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setUrgent(!!task.urgent);
    setNote(task.note || '');
    setDdl(task.ddl || null);
    setStepText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, visible]);

  if (!task) return null;

  const q = quadrantOf({ ddl, urgent }, threshold);
  const meta = QUADRANTS[q];
  const overdue = isOverdue(ddl);
  const total = task.subs ? task.subs.length : 0;
  const fin = task.subs ? task.subs.filter((s) => s.done).length : 0;
  const pct = total ? Math.round((fin / total) * 100) : 0;

  // 即时保存：把本地表单合并后写回任务
  const commit = (fields) => {
    const next = { title, ddl, urgent, note, ...fields };
    onUpdate({
      id: task.id,
      title: (next.title || '').trim() || task.title,
      ddl: next.ddl || null,
      urgent: next.urgent,
      note: (next.note || '').trim(),
    });
  };

  const pickDdl = (value) => { setDdl(value); commit({ ddl: value }); };
  const toggleUrgent = (v) => { setUrgent(v); commit({ urgent: v }); };

  const handleAddStep = () => {
    const v = stepText.trim();
    if (!v) return;
    onAddSub(v);
    setStepText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 标题（可直接编辑） */}
            <TextInput
              value={title}
              onChangeText={(v) => { setTitle(v); commit({ title: v }); }}
              placeholder="任务标题"
              placeholderTextColor={COLORS.muted}
              style={styles.titleInput}
              multiline
            />

            {/* 象限 + 截止（随设置实时变化） */}
            <View style={styles.metaRow}>
              <View style={[styles.badge, { backgroundColor: meta.color }]}>
                <Text style={styles.badgeText}>{meta.name}</Text>
              </View>
              <Text style={[styles.ddl, overdue && styles.overdue]}>
                {fmtDDL(ddl)}
              </Text>
            </View>

            {/* ---- 设置 ---- */}
            <Text style={styles.sectionLabel}>截止日期 (DDL)</Text>
            <View style={styles.ddlRow}>
              <DatePickerChip
                ddl={ddl}
                onChange={pickDdl}
                placeholder="选择日期"
              />
              <TouchableOpacity
                style={[styles.clearDdlBtn, !ddl && styles.clearDdlBtnActive]}
                onPress={() => pickDdl(null)}
              >
                <Text style={[styles.clearDdlText, !ddl && styles.clearDdlTextActive]}>无期限</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>标记为紧急</Text>
                <Text style={styles.switchHint}>紧急任务会进入「马上做」或「计划做」</Text>
              </View>
              <Switch
                value={urgent}
                onValueChange={toggleUrgent}
                trackColor={{ true: COLORS.accent, false: COLORS.line }}
                thumbColor={urgent ? '#fff' : '#f4f3f4'}
              />
            </View>

            <Text style={styles.sectionLabel}>备注</Text>
            <TextInput
              value={note}
              onChangeText={(v) => { setNote(v); commit({ note: v }); }}
              placeholder="补充说明...（可选）"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, styles.noteInput]}
              multiline
            />

            {/* ---- 实现步骤 ---- */}
            <View style={styles.progressHeader}>
              <Text style={styles.sectionLabel}>实现步骤</Text>
              <Text style={[styles.progressValue, { color: meta.color }]}>
                {total ? `${fin}/${total} · ${pct}%` : '暂无步骤'}
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
            </View>

            <View style={styles.subList}>
              {task.subs && task.subs.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.subRow}
                  onPress={() => onToggleSub(s.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, s.done && { backgroundColor: meta.color, borderColor: meta.color }]}>
                    {s.done && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={[styles.subText, s.done && styles.subTextDone]} numberOfLines={2}>
                    {s.text}
                  </Text>
                  <TouchableOpacity onPress={() => onDeleteSub(s.id)} style={styles.delSubBtn}>
                    <Text style={styles.delSubText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {total === 0 && (
                <Text style={styles.emptyHint}>把这件事拆成几步，记录做到了哪一步。</Text>
              )}
            </View>

            <View style={styles.addRow}>
              <TextInput
                value={stepText}
                onChangeText={setStepText}
                onSubmitEditing={handleAddStep}
                placeholder="+ 添加步骤，回车保存"
                placeholderTextColor={COLORS.muted}
                style={styles.addInput}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddStep}>
                <Text style={styles.addBtnText}>添加</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* ---- 操作 ---- */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.completeBtn} onPress={onComplete} activeOpacity={0.8}>
              <Text style={styles.completeBtnText}>
                {task.done ? '↩ 取消完成' : '✓ 标记完成'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
              <Text style={styles.deleteBtnText}>删除任务</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 8 },

  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: 8 },

  titleInput: {
    fontSize: 20, fontWeight: '800', color: COLORS.ink, lineHeight: 27,
    paddingVertical: 6, paddingHorizontal: 0,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ddl: { fontSize: 12, color: COLORS.sub },
  overdue: { color: COLORS.danger, fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.sub, marginTop: 18, marginBottom: 8 },
  ddlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearDdlBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
  },
  clearDdlBtnDisabled: {
    backgroundColor: COLORS.bg,
    borderColor: COLORS.line,
  },
  clearDdlBtnActive: {
    backgroundColor: COLORS.sub,
    borderColor: COLORS.sub,
  },
  clearDdlText: {
    fontSize: 13,
    color: COLORS.sub,
    fontWeight: '500',
  },
  clearDdlTextDisabled: {
    color: COLORS.muted,
  },
  clearDdlTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    padding: 14, marginTop: 16, gap: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  switchHint: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.ink,
  },
  noteInput: { minHeight: 56, textAlignVertical: 'top' },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressValue: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: COLORS.line, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  subList: { marginTop: 12, gap: 6 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.line,
    backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 14 },
  subText: { flex: 1, fontSize: 14, color: COLORS.ink },
  subTextDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  delSubBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  delSubText: { color: COLORS.muted, fontSize: 14 },
  emptyHint: { fontSize: 12, color: COLORS.muted, textAlign: 'center', marginTop: 8, marginBottom: 4 },

  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addInput: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink,
  },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  completeBtn: {
    flex: 1, backgroundColor: COLORS.success, borderRadius: 999, paddingVertical: 14, alignItems: 'center',
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1, borderColor: COLORS.danger + '40', borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', backgroundColor: '#F8F6F2',
  },
  deleteBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },
});
