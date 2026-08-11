// ============================================================
//  Life OS — 现代化确认弹窗
//  v2: 更精致的视觉 — 纯白卡片 + 大圆角 + 深阴影 + 胶囊按钮
// ============================================================
import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../constants';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, destructive ? styles.destructiveBtn : styles.confirmPrimary]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  message: { fontSize: 14, color: COLORS.sub, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: '#F4F2EE',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.sub },
  confirmPrimary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
