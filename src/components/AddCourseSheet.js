// ============================================================
//  Life OS — 新建/编辑课程 弹窗
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import { COLORS, WEEKDAYS, COURSE_COLORS } from '../constants';
import { todayStr, fmtYMD, weekdayOf } from '../utils/helpers';

// 生成今天起未来 14 天的日期选项（用于临时课程选日子）
function upcomingDates(n = 14) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const ymd = fmtYMD(d);
    out.push({
      ymd,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      wd: WEEKDAYS[weekdayOf(ymd) === 7 ? 0 : weekdayOf(ymd)],
      isToday: i === 0,
    });
  }
  return out;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
];

export default function AddCourseSheet({ visible, onClose, onSave, editCourse, defaultWeek }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [teacher, setTeacher] = useState('');
  const [location, setLocation] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:40');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [startWeek, setStartWeek] = useState('1');
  const [endWeek, setEndWeek] = useState('16');
  const [weekParity, setWeekParity] = useState('ALL');
  const [temporary, setTemporary] = useState(false);
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    if (editCourse) {
      setTitle(editCourse.title);
      setTeacher(editCourse.teacher || '');
      setLocation(editCourse.location || '');
      setDayOfWeek(editCourse.dayOfWeek);
      setStartTime(editCourse.startTime);
      setEndTime(editCourse.endTime);
      setColor(editCourse.color || COURSE_COLORS[0]);
      setStartWeek(String(editCourse.startWeek || 1));
      setEndWeek(String(editCourse.endWeek || 16));
      setWeekParity(editCourse.weekParity || 'ALL');
      setTemporary(!!editCourse.temporary);
      setDate(editCourse.date || todayStr());
    } else {
      setTitle(''); setTeacher(''); setLocation('');
      setDayOfWeek(1); setStartTime('08:00'); setEndTime('09:40');
      setColor(COURSE_COLORS[0]);
      // 新建课程时，默认起止周跟随当前查看的周次
      const dw = defaultWeek || 1;
      setStartWeek(String(dw));
      setEndWeek(String(dw));
      setWeekParity('ALL');
      setTemporary(false); setDate(todayStr());
    }
  }, [editCourse, visible, defaultWeek]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...(editCourse || {}),
      title: title.trim(),
      teacher: teacher.trim(),
      location: location.trim(),
      // 临时课用日期推出星期，方便概览统计；普通课用所选星期
      dayOfWeek: temporary ? weekdayOf(date) : dayOfWeek,
      startTime,
      endTime,
      color,
      temporary,
      date: temporary ? date : null,
      startWeek: parseInt(startWeek) || 1,
      endWeek: parseInt(endWeek) || 16,
      weekParity,
    });
    onClose();
  };

  const dateOptions = upcomingDates(14);

  const TimePicker = ({ visible, value, onSelect, onClose: onClosePicker }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClosePicker}>
      <TouchableOpacity style={styles.timeOverlay} onPress={onClosePicker} activeOpacity={1}>
        <View style={styles.timeSheet}>
          <Text style={styles.timeTitle}>选择时间</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {TIME_SLOTS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.timeOption, t === value && styles.timeOptionActive]}
                onPress={() => { onSelect(t); onClosePicker(); }}
              >
                <Text style={[styles.timeOptionText, t === value && styles.timeOptionTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editCourse ? '编辑课程' : '添加课程'}</Text>

          <Text style={styles.label}>课程名称</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="例如：高等数学" placeholderTextColor={COLORS.muted} style={styles.input} />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>教师</Text>
              <TextInput value={teacher} onChangeText={setTeacher} placeholder="可选" placeholderTextColor={COLORS.muted} style={styles.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>地点</Text>
              <TextInput value={location} onChangeText={setLocation} placeholder="可选" placeholderTextColor={COLORS.muted} style={styles.input} />
            </View>
          </View>

          {/* 临时课程开关 */}
          <TouchableOpacity
            style={styles.tempRow}
            activeOpacity={0.8}
            onPress={() => setTemporary((v) => !v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.tempTitle}>临时课程</Text>
              <Text style={styles.tempHint}>只在某一天上课，不按周重复（如调课、补课）</Text>
            </View>
            <View style={[styles.switch, temporary && styles.switchOn]}>
              <View style={[styles.switchDot, temporary && styles.switchDotOn]} />
            </View>
          </TouchableOpacity>

          {temporary ? (
            /* 临时课：选具体日期 */
            <>
              <Text style={styles.label}>上课日期</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  {dateOptions.map((d) => (
                    <TouchableOpacity
                      key={d.ymd}
                      style={[styles.dateChip, date === d.ymd && styles.chipActive]}
                      onPress={() => setDate(d.ymd)}
                    >
                      <Text style={[styles.dateChipDay, date === d.ymd && styles.chipTextActive]}>{d.label}</Text>
                      <Text style={[styles.dateChipWd, date === d.ymd && styles.chipTextActive]}>
                        {d.isToday ? '今天' : d.wd}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : (
            /* 普通课：选星期 */
            <>
              <Text style={styles.label}>星期</Text>
              <View style={styles.chips}>
                {WEEKDAYS.map((w, i) => {
                  const day = i === 0 ? 7 : i; // 周日=7
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.chip, dayOfWeek === day && styles.chipActive]}
                      onPress={() => setDayOfWeek(day)}
                    >
                      <Text style={[styles.chipText, dayOfWeek === day && styles.chipTextActive]}>{w}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* 时间选择 */}
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>开始时间</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowStartTime(true)}>
                <Text style={styles.timeBtnText}>{startTime}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>结束时间</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowEndTime(true)}>
                <Text style={styles.timeBtnText}>{endTime}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 颜色选择 */}
          <Text style={styles.label}>颜色标签</Text>
          <View style={styles.colorRow}>
            {COURSE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {/* 学期周次（临时课不需要） */}
          {!temporary && (
            <>
              <Text style={styles.label}>起止周</Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={startWeek}
                    onChangeText={setStartWeek}
                    placeholder="第几周"
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={endWeek}
                    onChangeText={setEndWeek}
                    placeholder="到第几周"
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Text style={styles.hint}>设置课程在第几周到第几周上课</Text>

              {/* 单双周 */}
              <Text style={styles.label}>单双周</Text>
              <View style={styles.chips}>
                {[
                  { value: 'ALL', label: '每周' },
                  { value: 'ODD', label: '单周' },
                  { value: 'EVEN', label: '双周' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, weekParity === opt.value && styles.chipActive]}
                    onPress={() => setWeekParity(opt.value)}
                  >
                    <Text style={[styles.chipText, weekParity === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]} onPress={handleSave} disabled={!title.trim()}>
            <Text style={styles.saveBtnText}>{editCourse ? '保存修改' : '添加课程'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingSheet>

      <TimePicker visible={showStartTime} value={startTime} onSelect={setStartTime} onClose={() => setShowStartTime(false)} />
      <TimePicker visible={showEndTime} value={endTime} onSelect={setEndTime} onClose={() => setShowEndTime(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.sub, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F8F6F2', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink },
  row2: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 12, color: COLORS.sub, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  timeBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  timeBtnText: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: COLORS.ink },
  hint: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  tempRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, padding: 12, gap: 10,
  },
  tempTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  tempHint: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  switch: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: COLORS.line,
    padding: 3, justifyContent: 'center',
  },
  switchOn: { backgroundColor: COLORS.accent },
  switchDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchDotOn: { alignSelf: 'flex-end' },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card,
    alignItems: 'center', minWidth: 52,
  },
  dateChipDay: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  dateChipWd: { fontSize: 10, color: COLORS.sub, marginTop: 2 },
  saveBtn: { backgroundColor: COLORS.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnDisabled: { backgroundColor: COLORS.line },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  timeOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  timeSheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '70%', maxHeight: '60%' },
  timeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 12, textAlign: 'center' },
  timeOption: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginBottom: 2 },
  timeOptionActive: { backgroundColor: COLORS.accent + '20' },
  timeOptionText: { fontSize: 15, color: COLORS.ink, textAlign: 'center' },
  timeOptionTextActive: { color: COLORS.accent, fontWeight: '700' },
});
