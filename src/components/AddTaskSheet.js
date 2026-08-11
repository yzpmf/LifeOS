// ============================================================
//  Life OS — 新建/编辑任务 底部弹窗
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
import { quadrantOf, fmtDDL } from '../utils/helpers';

export default function AddTaskSheet({ visible, onClose, onSave, editTask, threshold }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [ddl, setDdl] = useState(null); // YYYY-MM-DD 或 null
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setUrgent(editTask.urgent);
      setNote(editTask.note || '');
      setDdl(editTask.ddl || null);
    } else {
      setTitle('');
      setDdl(null);
      setUrgent(false);
      setNote('');
    }
  }, [editTask, visible]);

  const preview = title ? QUADRANTS[quadrantOf({ ddl, urgent }, threshold)] : null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...(editTask || {}),
      title: title.trim(),
      ddl,
      urgent,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editTask ? '编辑任务' : '新建任务'}</Text>

          {/* 标题 */}
          <Text style={styles.label}>任务标题</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="例如：写完产品 PRD"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            autoFocus={!editTask}
          />

          {/* DDL 选择 */}
          <Text style={styles.label}>截止日期 (DDL)</Text>
          <View style={styles.ddlRow}>
            <DatePickerChip
              ddl={ddl}
              onChange={setDdl}
              placeholder="选择日期"
            />
            <TouchableOpacity
              style={[styles.clearDdlBtn, !ddl && styles.clearDdlBtnActive]}
              onPress={() => setDdl(null)}
            >
              <Text style={[styles.clearDdlText, !ddl && styles.clearDdlTextActive]}>无期限</Text>
            </TouchableOpacity>
          </View>

          {/* 紧急开关 */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>标记为紧急</Text>
              <Text style={styles.switchHint}>紧急任务会进入「马上做」或「计划做」</Text>
            </View>
            <Switch
              value={urgent}
              onValueChange={setUrgent}
              trackColor={{ true: COLORS.accent, false: COLORS.line }}
              thumbColor={urgent ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* 备注 */}
          <Text style={styles.label}>备注（可选）</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="补充说明..."
            placeholderTextColor={COLORS.muted}
            style={[styles.input, styles.noteInput]}
            multiline
          />

          {/* 象限预览 */}
          {preview && (
            <View style={[styles.previewBox, { borderLeftColor: preview.color }]}>
              <Text style={styles.previewText}>
                将归入 <Text style={{ color: preview.color, fontWeight: '700' }}>{preview.icon} {preview.name}</Text>
                {' '}（{preview.desc}）
              </Text>
              <Text style={styles.previewSub}>
                {fmtDDL(ddl)} · {urgent ? '紧急' : '不紧急'}
              </Text>
            </View>
          )}

          {/* 保存按钮 */}
          <TouchableOpacity
            style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!title.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{editTask ? '保存修改' : '创建任务'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sub,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  noteInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  ddlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginTop: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
  },
  switchHint: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    marginTop: 16,
  },
  previewText: {
    fontSize: 13,
    color: COLORS.ink,
  },
  previewSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.line,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
