// ============================================================
//  Life OS — 新建/编辑习惯 弹窗
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import { COLORS, HABIT_ICONS, WEEKDAYS } from '../constants';

const REPEAT_OPTIONS = ['每天', '工作日', '周末', '自定义'];

export default function AddHabitSheet({ visible, onClose, onSave, editHabit }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📖');
  const [time, setTime] = useState('');
  const [repeatRule, setRepeatRule] = useState('每天');
  const [customDays, setCustomDays] = useState([]);

  useEffect(() => {
    if (editHabit) {
      setName(editHabit.name);
      setIcon(editHabit.icon || '📖');
      setTime(editHabit.time || '');
      setRepeatRule(editHabit.repeatRule || '每天');
      setCustomDays(Array.isArray(editHabit.customDays) ? editHabit.customDays : []);
    } else {
      setName(''); setIcon('📖'); setTime(''); setRepeatRule('每天'); setCustomDays([]);
    }
  }, [editHabit, visible]);

  const toggleDay = (wd) => {
    setCustomDays((prev) =>
      prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd].sort((a, b) => a - b)
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      ...(editHabit || {}),
      name: name.trim(),
      icon,
      time: time.trim(),
      repeatRule,
      customDays: repeatRule === '自定义' ? customDays : [],
    };
    onSave(payload);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editHabit ? '编辑习惯' : '新建习惯'}</Text>

          <Text style={styles.label}>习惯名称</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例如：背单词、运动、喝水"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            autoFocus
          />

          <Text style={styles.label}>选择图标</Text>
          <View style={styles.iconRow}>
            {HABIT_ICONS.map((ic) => (
              <TouchableOpacity
                key={ic}
                style={[styles.iconBtn, icon === ic && styles.iconBtnActive]}
                onPress={() => setIcon(ic)}
              >
                <Text style={styles.iconText}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>提醒时间（可选）</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="例如：08:00（不填则不提醒）"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>重复周期</Text>
          <View style={styles.chips}>
            {REPEAT_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, repeatRule === r && styles.chipActive]}
                onPress={() => setRepeatRule(r)}
              >
                <Text style={[styles.chipText, repeatRule === r && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {repeatRule === '自定义' && (
            <>
              <Text style={styles.label}>选择每周哪几天</Text>
              <View style={styles.dayRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                  const active = customDays.includes(wd);
                  return (
                    <TouchableOpacity
                      key={wd}
                      style={[styles.dayBtn, active && styles.dayBtnActive]}
                      onPress={() => toggleDay(wd)}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>
                        {WEEKDAYS[wd === 7 ? 0 : wd].replace('星期', '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]} onPress={handleSave} disabled={!name.trim()}>
            <Text style={styles.saveBtnText}>{editHabit ? '保存修改' : '创建习惯'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.sub, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8F6F2', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  iconText: { fontSize: 20 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, color: COLORS.sub, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  dayRow: { flexDirection: 'row', gap: 8 },
  dayBtn: {
    flex: 1, height: 40, borderRadius: 10, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dayText: { fontSize: 13, color: COLORS.sub, fontWeight: '600' },
  dayTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { backgroundColor: COLORS.line },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
