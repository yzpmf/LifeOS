// ============================================================
//  Life OS — 底部 Tab 导航
// ============================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants';

const TABS = [
  { key: 'todo', label: '待办', icon: 'check-square' },
  { key: 'course', label: '课程表', icon: 'calendar' },
  { key: 'habit', label: '打卡', icon: 'target' },
  { key: 'learn', label: '学习', icon: 'book' },
  { key: 'settings', label: '我的', icon: 'user' },
];

export default function TabNav({ active, onTabChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: 8 + insets.bottom }]}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon}
              size={22}
              color={isActive ? COLORS.accent : COLORS.muted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: {
    fontSize: 20,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '500',
  },
  labelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
});
