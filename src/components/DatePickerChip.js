// ============================================================
//  Life OS — 日期选择器（Chip + 系统日期选择弹窗）
// ============================================================
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants';
import { parseYMD, fmtYMD, fmtDate, daysLeft } from '../utils/helpers';

export default function DatePickerChip({ ddl, onChange, placeholder = '选择日期' }) {
  const [show, setShow] = useState(false);

  const hasDdl = Boolean(ddl);
  const date = hasDdl ? parseYMD(ddl) : new Date();
  const displayText = hasDdl ? fmtDate(ddl) : placeholder;
  const relative = hasDdl ? daysLeft(ddl) : null;

  const onSelect = (event, selected) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'dismissed') return;
      if (selected) onChange(fmtYMD(selected));
    } else {
      // iOS：每次滚动都触发；只在 event.type !== 'dismissed' 时提交
      if (event.type === 'dismissed') {
        setShow(false);
        return;
      }
      if (selected) onChange(fmtYMD(selected));
    }
  };

  const onIOSDismiss = () => setShow(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.chip, hasDdl && styles.chipActive]}
        onPress={() => setShow(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, hasDdl && styles.chipTextActive]}>{displayText}</Text>
        {relative !== null && (
          <Text style={[styles.subText, hasDdl && styles.subTextActive]}>
            {relative === 0 ? '今天' : relative > 0 ? `${relative}天后` : `${-relative}天前`}
          </Text>
        )}
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onSelect}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date(2099, 11, 31)}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          onChange={onSelect}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date(2099, 11, 31)}
          onDismiss={onIOSDismiss}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.sub,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  subText: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 1,
  },
  subTextActive: {
    color: 'rgba(255,255,255,0.85)',
  },
});
