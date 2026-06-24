// ============================================================
//  Life OS — 四象限网格
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, QUADRANTS } from '../constants';
import TaskCard from './TaskCard';

export default function QuadrantGrid({ groups, threshold, onOpenTask }) {
  return (
    <View style={styles.grid}>
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
        const meta = QUADRANTS[q];
        const tasks = groups[q];
        return (
          <View key={q} style={[styles.cell, { borderTopColor: meta.color }]}>
            <View style={styles.cellHead}>
              <Text style={[styles.cellTitle, { color: meta.color }]}>
                {meta.name}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: meta.color + '20' }]}>
                <Text style={[styles.countText, { color: meta.color }]}>{tasks.length}</Text>
              </View>
            </View>
            <Text style={styles.cellDesc}>{meta.desc}</Text>
            {tasks.length === 0 ? (
              <Text style={styles.empty}>暂无任务</Text>
            ) : (
              tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  threshold={threshold}
                  onPress={() => onOpenTask(t.id)}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  cell: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderTopWidth: 3,
    padding: 10,
    minHeight: 120,
  },
  cellHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cellTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cellDesc: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 8,
  },
  empty: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },
});
