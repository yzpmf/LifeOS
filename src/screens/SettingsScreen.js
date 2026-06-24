// ============================================================
//  Life OS — 设置页面
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch,
} from 'react-native';
import { COLORS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { settings, tasks, courses, habits } = state;

  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);

  const updateSetting = (key, value) => {
    dispatch({ type: 'SET_SETTINGS', payload: { [key]: value } });
  };

  const handleClearData = async () => {
    const ok = await confirm({
      title: '清除所有数据',
      message: '此操作不可恢复，确定继续？',
      confirmText: '清除',
      destructive: true,
    });
    if (!ok) return;
    try {
      await Promise.all(Object.values(STORAGE_KEYS).map((k) => AsyncStorage.removeItem(k)));
      showToast('已清除，请重启应用以加载默认数据', 'success');
    } catch (e) {
      showToast('清除失败', 'error');
    }
  };

  const activeTasks = tasks.filter((t) => !t.done && !t.deleted).length;
  const doneTasks = tasks.filter((t) => t.done && !t.deleted).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* 头部 */}
      <Text style={styles.title}>我的</Text>
      <Text style={styles.subtitle}>账号 · API · 偏好设置</Text>

      {/* 数据概览 */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{activeTasks}</Text>
          <Text style={styles.statLabel}>进行中</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{doneTasks}</Text>
          <Text style={styles.statLabel}>已完成</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{courses.length}</Text>
          <Text style={styles.statLabel}>课程</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{habits.length}</Text>
          <Text style={styles.statLabel}>习惯</Text>
        </View>
      </View>

      {/* AI 配置 */}
      <Section title="大模型 API 配置">
        <Field label="接口地址 (Base URL)">
          <TextInput
            value={settings.aiBaseUrl}
            onChangeText={(v) => updateSetting('aiBaseUrl', v)}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor={COLORS.muted}
            style={styles.fieldInput}
            autoCapitalize="none"
          />
        </Field>
        <Field label="API Key">
          <View style={styles.apiKeyRow}>
            <TextInput
              value={settings.aiApiKey}
              onChangeText={(v) => updateSetting('aiApiKey', v)}
              placeholder="sk-..."
              placeholderTextColor={COLORS.muted}
              style={[styles.fieldInput, { flex: 1 }]}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.showBtn}>
              <Text style={styles.showBtnText}>{showApiKey ? '隐藏' : '显示'}</Text>
            </TouchableOpacity>
          </View>
        </Field>
        <Field label="模型名称">
          <TextInput
            value={settings.aiModel}
            onChangeText={(v) => updateSetting('aiModel', v)}
            placeholder="gpt-4o-mini"
            placeholderTextColor={COLORS.muted}
            style={styles.fieldInput}
            autoCapitalize="none"
          />
        </Field>
        <Text style={styles.fieldHint}>
          兼容 OpenAI 格式接口。填入你自己的 API Key，数据仅存储在本地。
        </Text>
        <TouchableOpacity
          style={[styles.testBtn, testing && { opacity: 0.6 }]}
          onPress={async () => {
            if (testing) return;
            if (!settings.aiApiKey) {
              showToast('请先填写 API Key', 'error');
              return;
            }
            setTesting(true);
            try {
              const url = `${settings.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
              const resp = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${settings.aiApiKey}`,
                },
                body: JSON.stringify({
                  model: settings.aiModel || 'gpt-4o-mini',
                  messages: [{ role: 'user', content: 'Hi' }],
                  max_tokens: 5,
                }),
              });
              if (resp.ok) {
                const data = await resp.json();
                showToast(`连接成功 · ${data.model || settings.aiModel}`, 'success');
              } else {
                showToast(`连接失败（${resp.status}）`, 'error');
              }
            } catch (err) {
              showToast(`连接失败：${err.message}`, 'error');
            } finally {
              setTesting(false);
            }
          }}
        >
          <Text style={styles.testBtnText}>{testing ? '测试中...' : '测试连接'}</Text>
        </TouchableOpacity>
      </Section>

      {/* 待办规则 */}
      <Section title="待办规则">
        <Field label="短期阈值（天）">
          <View style={styles.thresholdRow}>
            {[3, 5, 7, 14].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.thresholdChip, settings.threshold === n && styles.thresholdChipActive]}
                onPress={() => updateSetting('threshold', n)}
              >
                <Text style={[styles.thresholdText, settings.threshold === n && styles.thresholdTextActive]}>
                  {n} 天
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        <Text style={styles.fieldHint}>
          剩余天数 ≤ 此值的任务自动归入「短期」象限。
        </Text>
      </Section>

      {/* 学期设置 */}
      <Section title="学期设置">
        <Field label="开学日期">
          <TextInput
            value={settings.semesterStart}
            onChangeText={(v) => updateSetting('semesterStart', v)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.muted}
            style={styles.fieldInput}
          />
        </Field>
        <Text style={styles.fieldHint}>
          用于计算当前第几周和课程的单双周。格式：2025-09-01
        </Text>
      </Section>

      {/* 通知设置 */}
      <Section title="通知设置">
        <View style={styles.switchField}>
          <Text style={styles.switchLabel}>启用通知提醒</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(v) => updateSetting('notificationsEnabled', v)}
            trackColor={{ true: COLORS.accent, false: COLORS.line }}
          />
        </View>
        <Text style={styles.fieldHint}>
          包括课程提醒、任务到期提醒、打卡提醒。需要授予通知权限。
        </Text>
      </Section>

      {/* 数据管理 */}
      <Section title="数据管理">
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
          <Text style={styles.dangerBtnText}>清除所有数据</Text>
        </TouchableOpacity>
        <Text style={styles.fieldHint}>
          清除本地缓存的任务、课程、习惯和设置数据。
        </Text>
      </Section>

      {/* 关于 */}
      <Section title="关于">
        <Text style={styles.aboutText}>
          Life OS — 你的个人生活操作系统{'\n'}
          版本 1.0.0 (MVP){'\n\n'}
          功能：四象限待办 · 课程表 · 每日打卡 · AI 助手
        </Text>
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.sub, marginTop: 2, marginBottom: 16 },

  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, padding: 18, marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: COLORS.accent },
  statLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.line, marginVertical: 4 },

  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.sub, marginBottom: 8, paddingHorizontal: 2 },
  sectionCard: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line,
    padding: 16, gap: 12,
  },

  field: {},
  fieldLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  fieldInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.ink,
  },
  fieldHint: { fontSize: 11, color: COLORS.muted, lineHeight: 16 },

  apiKeyRow: { flexDirection: 'row', gap: 8 },
  showBtn: { paddingHorizontal: 12, justifyContent: 'center', backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line },
  showBtnText: { fontSize: 12, color: COLORS.sub, fontWeight: '600' },

  testBtn: {
    backgroundColor: COLORS.accentSoft, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '30',
  },
  testBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 13 },

  thresholdRow: { flexDirection: 'row', gap: 8 },
  thresholdChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg,
  },
  thresholdChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  thresholdText: { fontSize: 13, color: COLORS.sub, fontWeight: '500' },
  thresholdTextActive: { color: '#fff', fontWeight: '700' },

  switchField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink },

  dangerBtn: {
    borderWidth: 1, borderColor: COLORS.danger + '40', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', backgroundColor: COLORS.card,
  },
  dangerBtnText: { color: COLORS.danger, fontWeight: '600', fontSize: 14 },

  aboutText: { fontSize: 13, color: COLORS.sub, lineHeight: 20 },
});
