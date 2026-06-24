// ============================================================
//  Life OS — 任务卡片组件
// ============================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, QUADRANTS } from '../constants';
import { fmtDDL, isOverdue, quadrantOf } from '../utils/helpers';

export default function TaskCard({ task, threshold, onPress }) {
  const q = quadrantOf(task, threshold);
  const meta = QUADRANTS[q];
  const overdue = isOverdue(task.ddl);
  const total = task.subs ? task.subs.length : 0;
  const fin = task.subs ? task.subs.filter((s) => s.done).length : 0;
  const pct = total ? Math.round((fin / total) * 100) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.name}</Text>
        </View>
      </View>
      <Text style={[styles.ddl, overdue && styles.overdue]}>
        {fmtDDL(task.ddl)}
      </Text>
      {total > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
          </View>
          <Text style={styles.barLabel}>{fin}/{total}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ddl: {
    fontSize: 11,
    color: COLORS.sub,
    marginTop: 6,
  },
  overdue: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  barLabel: {
    fontSize: 10,
    color: COLORS.muted,
  },
});
