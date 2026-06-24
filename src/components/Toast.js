// ============================================================
//  Life OS — 轻量 Toast 提示（替代老式 Alert 弹窗）
//  顶部滑入的胶囊提示，支持成功/错误/信息三种样式，
//  可附带一个操作按钮（如「撤销」）。
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants';

const ICONS = { success: '✓', error: '✕', info: 'i' };
const TINTS = {
  success: COLORS.success,
  error: COLORS.danger,
  info: COLORS.accent,
};

export default function Toast({ toast, onHide }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // 保留正在退场的内容，避免淡出时直接消失
  const [current, setCurrent] = useState(toast);

  useEffect(() => {
    if (toast) {
      setCurrent(toast);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 9,
        tension: 90,
      }).start();
    } else if (current) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setCurrent(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!current) return null;

  const tint = TINTS[current.type] || COLORS.ink;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const action = current.action;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tint }]}>
          <Text style={styles.icon}>{ICONS[current.type] || ICONS.info}</Text>
        </View>
        <Text style={styles.msg} numberOfLines={2}>{current.message}</Text>
        {action ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              action.onPress?.();
              onHide?.();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '92%',
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    gap: 10,
    boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
    elevation: 8,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  msg: { flexShrink: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  actionBtn: {
    marginLeft: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  actionText: { color: COLORS.accent, fontSize: 13, fontWeight: '800' },
});
