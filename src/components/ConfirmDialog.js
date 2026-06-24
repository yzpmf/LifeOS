// ============================================================
//  Life OS — 现代化确认弹窗（替代 Alert.alert 的确认框）
//  圆角卡片 + 取消/确认按钮，确认按钮可设为危险（红色）样式。
// ============================================================
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <View style={styles.card}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.destructiveBtn : styles.confirmBtn]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 22,
    boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
    elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  message: { fontSize: 14, color: COLORS.sub, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.sub },
  confirmBtn: { backgroundColor: COLORS.accent },
  destructiveBtn: { backgroundColor: COLORS.danger },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
