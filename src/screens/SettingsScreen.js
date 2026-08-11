// ============================================================
//  Life OS — 设置页面（折叠式，简洁）
//  语言模型 / 嵌入模型全部自定义输入，支持获取模型列表。
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, Switch, ActivityIndicator, FlatList,
} from 'react-native';
import { testEmbeddingConnection } from '../utils/embeddings';
import { Feather } from '@expo/vector-icons';
import { COLORS, STORAGE_KEYS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import { storageRemove, setDesktopUrl, getDesktopUrl, getSyncStatus, syncPendingToBackend, resetBackendCache } from '../utils/storage';

// ---- 模型选择弹窗 ----
function ModelPickerModal({ visible, onClose, models, loading, onSelect }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>选择模型</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.modalLoadingText}>正在获取模型列表...</Text>
            </View>
          ) : models.length === 0 ? (
            <Text style={styles.modalEmpty}>未能获取模型列表，请确认 API Key 和 Base URL 正确。</Text>
          ) : (
            <FlatList
              data={models}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modelItem} onPress={() => onSelect(item.id)}>
                  <Text style={styles.modelItemText} numberOfLines={1}>{item.id}</Text>
                  {item.owned_by ? <Text style={styles.modelItemOwner}>{item.owned_by}</Text> : null}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { settings, tasks, courses, habits, diary, insights } = state;

  const [expanded, setExpanded] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);

  // 模型列表
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelList, setModelList] = useState([]);
  const [modelPickerFor, setModelPickerFor] = useState(null); // 'llm' | 'embedding'

  // 同步设置
  const [desktopUrl, setDesktopUrlState] = useState('');
  const [syncStatus, setSyncStatus] = useState({ online: false, pendingCount: 0 });
  const [syncing, setSyncing] = useState(false);

  const toggle = (key) => setExpanded(expanded === key ? null : key);

  const updateSetting = (key, value) => {
    dispatch({ type: 'SET_SETTINGS', payload: { [key]: value } });
  };

  const llmApiKey = settings.llmApiKey || '';
  const llmBaseUrl = settings.llmBaseUrl || '';
  const llmModel = settings.llmModel || '';

  const embApiKey = settings.embeddingApiKey || '';
  const embBaseUrl = settings.embeddingBaseUrl || '';
  const embModel = settings.embeddingModel || '';

  // 初始化：读取桌面端地址
  useEffect(() => {
    (async () => {
      try {
        const url = await getDesktopUrl();
        setDesktopUrlState(url);
      } catch (e) {
        console.warn('读取桌面端地址失败', e);
      }
    })();
  }, []);

  // 刷新同步状态
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (e) {
      console.warn('刷新同步状态失败', e);
    }
  }, []);

  useEffect(() => {
    if (expanded === 'sync') refreshSyncStatus();
  }, [expanded, refreshSyncStatus]);

  const handleSaveDesktopUrl = async () => {
    const normalized = await setDesktopUrl(desktopUrl);
    setDesktopUrlState(normalized.replace(/\/api$/, ''));
    resetBackendCache();
    showToast('已保存桌面端地址', 'success');
    await refreshSyncStatus();
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncPendingToBackend();
      if (result.ok) {
        showToast(`同步成功：推送 ${result.pushedKeys.length} 项，拉取 ${result.pulledKeys.length} 项`, 'success');
      } else {
        showToast('同步失败：桌面端不在线', 'error');
      }
    } catch (e) {
      showToast(`同步失败：${e.message}`, 'error');
    } finally {
      setSyncing(false);
      await refreshSyncStatus();
    }
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
      await Promise.all(Object.values(STORAGE_KEYS).map((k) => storageRemove(k)));
      showToast('已清除，请重启应用以加载默认数据', 'success');
    } catch (e) {
      showToast('清除失败', 'error');
    }
  };

  // ---- 获取模型列表 ----
  const fetchModelList = useCallback(async (apiKey, baseUrl) => {
    if (!apiKey) {
      showToast('请先填写 API Key', 'error');
      return;
    }
    if (!baseUrl) {
      showToast('请先填写 Base URL', 'error');
      return;
    }
    setFetchingModels(true);
    setModelList([]);
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/models`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }

      const data = await resp.json();
      const models = Array.isArray(data?.data) ? data.data : [];
      // 排序：优先 chat/instruction 模型，然后按名称
      const sorted = [...models].sort((a, b) => {
        const aIsChat = /chat|instruct|gpt|qwen|deepseek|claude|gemini|llama/i.test(a.id);
        const bIsChat = /chat|instruct|gpt|qwen|deepseek|claude|gemini|llama/i.test(b.id);
        if (aIsChat && !bIsChat) return -1;
        if (!aIsChat && bIsChat) return 1;
        return a.id.localeCompare(b.id);
      });
      setModelList(sorted);

      if (sorted.length === 0) {
        showToast('该接口未返回模型列表，请手动填写模型名称', 'warning');
      }
    } catch (err) {
      console.warn('获取模型列表失败:', err);
      showToast(`获取失败：${err.message}`, 'error');
      setModelList([]);
    } finally {
      setFetchingModels(false);
    }
  }, [showToast]);

  // 选择模型
  const handleModelSelect = useCallback((modelId) => {
    if (modelPickerFor === 'llm') {
      updateSetting('llmModel', modelId);
    } else if (modelPickerFor === 'embedding') {
      updateSetting('embeddingModel', modelId);
    }
    setModelPickerFor(null);
    setModelList([]);
    showToast(`已选择：${modelId}`, 'success');
  }, [modelPickerFor, updateSetting, showToast]);

  const handleFetchLLMModels = () => {
    setModelPickerFor('llm');
    fetchModelList(llmApiKey, llmBaseUrl);
  };

  const handleFetchEmbModels = () => {
    // 嵌入模型用相同的 /models 端点，API Key 优先用独立的，否则复用 LLM 的
    const key = embApiKey || llmApiKey;
    const url = embBaseUrl || llmBaseUrl;
    if (!key) { showToast('请先填写嵌入模型 API Key（或语言模型 API Key）', 'error'); return; }
    if (!url) { showToast('请先填写嵌入模型 Base URL', 'error'); return; }
    setModelPickerFor('embedding');
    fetchModelList(key, url);
  };

  // ---- 测试连接 ----
  const testEmbeddingConn = async () => {
    if (testing) return;
    const key = embApiKey || llmApiKey;
    const url = embBaseUrl || llmBaseUrl;
    const model = embModel || llmModel;
    if (!key) { showToast('请先填写 API Key（或语言模型 API Key）', 'error'); return; }
    if (!url) { showToast('请先填写 Base URL', 'error'); return; }
    if (!model) { showToast('请先选择或填写模型名称', 'error'); return; }
    setTesting(true);
    try {
      const dims = await testEmbeddingConnection({ embeddingApiKey: key, embeddingBaseUrl: url, embeddingModel: model });
      showToast(`连接成功 · 向量维度 ${dims}`, 'success');
    } catch (err) {
      showToast(`连接失败：${err.message}`, 'error');
    } finally { setTesting(false); }
  };

  const testLLMConnection = async () => {
    if (testing) return;
    if (!llmApiKey) { showToast('请先填写 API Key', 'error'); return; }
    if (!llmBaseUrl) { showToast('请先填写 Base URL', 'error'); return; }
    if (!llmModel) { showToast('请先选择或填写模型名称', 'error'); return; }
    setTesting(true);
    try {
      const url = `${llmBaseUrl.replace(/\/+$/, '')}/chat/completions`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmApiKey}` },
        body: JSON.stringify({ model: llmModel, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        showToast(`连接成功 · ${data.model || llmModel}`, 'success');
      } else {
        showToast(`连接失败（${resp.status}）`, 'error');
      }
    } catch (err) {
      showToast(`连接失败：${err.message}`, 'error');
    } finally { setTesting(false); }
  };

  const activeTasks = tasks.filter((t) => !t.done && !t.deleted).length;
  const doneTasks = tasks.filter((t) => t.done && !t.deleted).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>我的</Text>
      <Text style={styles.subtitle}>账号 · API · 偏好设置</Text>

      {/* 数据概览 */}
      <View style={styles.statsCard}>
        <StatItem num={activeTasks} label="进行中" />
        <StatItem num={doneTasks} label="已完成" />
        <StatItem num={courses.length} label="课程" />
        <StatItem num={habits.length} label="习惯" />
        <StatItem num={diary.length + insights.length} label="笔记" />
      </View>

      {/* ==================== 语言模型 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('llm')} activeOpacity={0.7}>
        <Feather name="cpu" size={18} color={COLORS.accent} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>语言模型</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {llmModel || '未配置'}
          </Text>
        </View>
        <View style={[styles.statusDot, llmModel ? styles.statusDotActive : styles.statusDotInactive]} />
        <Feather name={expanded === 'llm' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'llm' && (
        <View style={styles.expanded}>
          <Text style={styles.expHint}>填写 OpenAI 兼容的 API 信息。支持 OpenAI、DeepSeek、硅基流动、阿里云 DashScope 等。</Text>

          <Field label="接口地址 (Base URL)">
            <TextInput
              value={llmBaseUrl}
              onChangeText={(v) => updateSetting('llmBaseUrl', v)}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="none"
            />
          </Field>

          <Field label="API Key">
            <View style={styles.keyRow}>
              <TextInput
                value={llmApiKey}
                onChangeText={(v) => updateSetting('llmApiKey', v)}
                placeholder="sk-..."
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { flex: 1 }]}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.showBtn}>
                <Text style={styles.showBtnText}>{showApiKey ? '隐藏' : '显示'}</Text>
              </TouchableOpacity>
            </View>
          </Field>

          <Field label="模型名称">
            <View style={styles.modelField}>
              <TextInput
                value={llmModel}
                onChangeText={(v) => updateSetting('llmModel', v)}
                placeholder="gpt-4o-mini"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.fetchBtn}
                onPress={handleFetchLLMModels}
                disabled={fetchingModels}
              >
                <Text style={styles.fetchBtnText}>获取模型列表</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modelFieldHint}>
              填写 API Key 和 Base URL 后，点击「获取模型列表」可拉取可用模型并选择。
            </Text>
          </Field>

          <TouchableOpacity style={styles.testBtn} onPress={testLLMConnection} disabled={testing}>
            <Text style={styles.testBtnText}>{testing ? '测试中...' : '测试连接'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== 嵌入模型 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('embedding')} activeOpacity={0.7}>
        <Feather name="layers" size={18} color="#8B5CF6" />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>嵌入模型</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {embModel || '未配置'}
          </Text>
        </View>
        <View style={[styles.statusDot, embModel ? styles.statusDotActive : styles.statusDotInactive]} />
        <Feather name={expanded === 'embedding' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'embedding' && (
        <View style={styles.expanded}>
          <Text style={styles.expHint}>
            用于日记/学习笔记的语义检索（RAG）。
            API Key 留空则自动复用语言模型的 API Key。
          </Text>

          <Field label="接口地址 (Base URL)">
            <TextInput
              value={embBaseUrl}
              onChangeText={(v) => updateSetting('embeddingBaseUrl', v)}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="none"
            />
          </Field>

          <Field label="API Key（可选）">
            <TextInput
              value={embApiKey}
              onChangeText={(v) => updateSetting('embeddingApiKey', v)}
              placeholder={llmApiKey ? '（已复用语言模型 API Key）' : 'sk-...'}
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />
          </Field>

          <Field label="模型名称">
            <View style={styles.modelField}>
              <TextInput
                value={embModel}
                onChangeText={(v) => updateSetting('embeddingModel', v)}
                placeholder="text-embedding-3-large"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.fetchBtn}
                onPress={handleFetchEmbModels}
                disabled={fetchingModels}
              >
                <Text style={styles.fetchBtnText}>获取模型列表</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modelFieldHint}>
              获取到的列表中会包含 embedding 模型，通常以 embedding 或 bge 开头。
            </Text>
          </Field>

          <TouchableOpacity style={styles.testBtn} onPress={testEmbeddingConn} disabled={testing}>
            <Text style={styles.testBtnText}>{testing ? '测试中...' : '测试连接'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== 待办规则 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('todo')} activeOpacity={0.7}>
        <Feather name="list" size={18} color={COLORS.q3} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>待办规则</Text>
          <Text style={styles.rowSub}>{settings.threshold} 天内视为短期</Text>
        </View>
        <Feather name={expanded === 'todo' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'todo' && (
        <View style={styles.expanded}>
          <Text style={styles.expLabel}>短期阈值（天）</Text>
          <View style={styles.chipRow}>
            {[3, 5, 7, 14].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, settings.threshold === n && styles.chipActive]}
                onPress={() => updateSetting('threshold', n)}
              >
                <Text style={[styles.chipText, settings.threshold === n && styles.chipTextActive]}>{n} 天</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.expHint}>剩余天数 ≤ 此值的任务自动归入「短期」象限。</Text>
        </View>
      )}

      {/* ==================== 学期设置 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('semester')} activeOpacity={0.7}>
        <Feather name="calendar" size={18} color={COLORS.q2} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>学期设置</Text>
          <Text style={styles.rowSub}>开学 {settings.semesterStart}</Text>
        </View>
        <Feather name={expanded === 'semester' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'semester' && (
        <View style={styles.expanded}>
          <Field label="开学日期">
            <TextInput
              value={settings.semesterStart}
              onChangeText={(v) => updateSetting('semesterStart', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />
          </Field>
          <Text style={styles.expHint}>用于计算当前第几周和课程的单双周。格式：2025-09-01</Text>
        </View>
      )}

      {/* ==================== 通知设置 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('notify')} activeOpacity={0.7}>
        <Feather name="bell" size={18} color={COLORS.warning} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>通知设置</Text>
          <Text style={styles.rowSub}>{settings.notificationsEnabled ? '已开启' : '已关闭'}</Text>
        </View>
        <Feather name={expanded === 'notify' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'notify' && (
        <View style={styles.expanded}>
          <View style={styles.switchField}>
            <Text style={styles.switchLabel}>启用通知提醒</Text>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateSetting('notificationsEnabled', v)}
              trackColor={{ true: COLORS.accent, false: COLORS.line }}
            />
          </View>
          <Text style={styles.expHint}>包括课程提醒、任务到期提醒、打卡提醒。需要授予通知权限。</Text>
        </View>
      )}

      {/* ==================== 同步设置 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('sync')} activeOpacity={0.7}>
        <Feather name="refresh-cw" size={18} color={COLORS.accent} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>同步设置</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {syncStatus.online ? '已连接桌面端' : '未连接'}
            {syncStatus.pendingCount > 0 ? ` · ${syncStatus.pendingCount} 项待同步` : ''}
          </Text>
        </View>
        <View style={[styles.statusDot, syncStatus.online ? styles.statusDotActive : styles.statusDotInactive]} />
        <Feather name={expanded === 'sync' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'sync' && (
        <View style={styles.expanded}>
          <Text style={styles.expHint}>
            手机和电脑在同一 WiFi 下，填写电脑的局域网 IP 即可实时同步。
            格式：http://192.168.x.x:2456
          </Text>

          <Field label="桌面端地址">
            <View style={styles.modelField}>
              <TextInput
                value={desktopUrl}
                onChangeText={(v) => setDesktopUrlState(v)}
                placeholder="http://192.168.1.5:2456"
                placeholderTextColor={COLORS.muted}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.fetchBtn} onPress={handleSaveDesktopUrl}>
                <Text style={styles.fetchBtnText}>保存</Text>
              </TouchableOpacity>
            </View>
          </Field>

          <View style={styles.syncInfoRow}>
            <Text style={styles.syncInfoLabel}>当前状态</Text>
            <Text style={[styles.syncInfoValue, syncStatus.online ? { color: COLORS.success } : { color: COLORS.muted }]}>
              {syncStatus.online ? '在线 · 数据实时同步' : '离线 · 数据写入本地'}
            </Text>
          </View>

          {syncStatus.pendingCount > 0 && (
            <View style={styles.syncInfoRow}>
              <Text style={styles.syncInfoLabel}>待同步项</Text>
              <Text style={styles.syncInfoValue}>{syncStatus.pendingCount} 项</Text>
            </View>
          )}

          <TouchableOpacity style={styles.testBtn} onPress={handleSyncNow} disabled={syncing}>
            <Text style={styles.testBtnText}>{syncing ? '同步中...' : '立即同步'}</Text>
          </TouchableOpacity>

          <Text style={styles.expHint}>
            提示：桌面端启动后，手机端会自动检测并切换。离线时写入本地，恢复连接后自动合并。
          </Text>
        </View>
      )}

      {/* ==================== 数据管理 ==================== */}
      <TouchableOpacity style={styles.row} onPress={() => toggle('data')} activeOpacity={0.7}>
        <Feather name="database" size={18} color={COLORS.danger} />
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>数据管理</Text>
          <Text style={styles.rowSub}>清除 / 重置</Text>
        </View>
        <Feather name={expanded === 'data' ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} />
      </TouchableOpacity>

      {expanded === 'data' && (
        <View style={styles.expanded}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
            <Text style={styles.dangerBtnText}>清除所有数据</Text>
          </TouchableOpacity>
          <Text style={styles.expHint}>清除本地缓存的任务、课程、习惯、笔记和设置数据。不可恢复。</Text>
        </View>
      )}

      {/* 关于 */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutText}>
          Life OS — 你的个人生活操作系统{'\n'}
          版本 1.0.0 (MVP){'\n\n'}
          功能：四象限待办 · 课程表 · 每日打卡 · AI 助手 · 学习笔记
        </Text>
      </View>

      <View style={{ height: 40 }} />

      {/* ---- 模型选择弹窗 ---- */}
      <ModelPickerModal
        visible={modelPickerFor !== null}
        onClose={() => { setModelPickerFor(null); setModelList([]); }}
        models={modelList}
        loading={fetchingModels}
        onSelect={handleModelSelect}
      />
    </ScrollView>
  );
}

// ---- 小组件 ----
function StatItem({ num, label }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

  // 数据概览
  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, padding: 12, marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: COLORS.accent },
  statLabel: { fontSize: 10, color: COLORS.muted, marginTop: 2 },

  // 折叠行
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, gap: 10,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  rowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  // 状态指示点
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotActive: { backgroundColor: COLORS.success },
  statusDotInactive: { backgroundColor: COLORS.line },

  // 展开区域
  expanded: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    padding: 14, marginBottom: 8, gap: 10,
  },
  expLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  expHint: { fontSize: 11, color: COLORS.muted, lineHeight: 16 },

  // 芯片
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.bg,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 12, color: COLORS.sub, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // 输入
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, color: COLORS.muted },
  input: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, color: COLORS.ink,
  },
  keyRow: { flexDirection: 'row', gap: 8 },

  // 模型字段
  modelField: { flexDirection: 'row', gap: 8 },
  modelFieldHint: { fontSize: 10, color: COLORS.muted, lineHeight: 14, marginTop: 2 },
  fetchBtn: {
    backgroundColor: COLORS.accentSoft, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent + '30',
    paddingHorizontal: 12, justifyContent: 'center',
  },
  fetchBtnText: { fontSize: 11, color: COLORS.accent, fontWeight: '700' },

  // 显示按钮
  showBtn: { paddingHorizontal: 10, justifyContent: 'center', backgroundColor: COLORS.bg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.line },
  showBtnText: { fontSize: 11, color: COLORS.sub, fontWeight: '600' },

  // 测试按钮
  testBtn: {
    backgroundColor: COLORS.accentSoft, borderRadius: 8, paddingVertical: 9,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '30',
  },
  testBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 13 },

  // 同步信息
  syncInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  syncInfoLabel: { fontSize: 13, color: COLORS.muted },
  syncInfoValue: { fontSize: 13, fontWeight: '700', color: COLORS.ink },

  // 开关
  switchField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink },

  // 危险按钮
  dangerBtn: {
    borderWidth: 1, borderColor: COLORS.danger + '40', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.card,
  },
  dangerBtnText: { color: COLORS.danger, fontWeight: '600', fontSize: 13 },

  // 关于
  aboutBox: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line,
    padding: 14, marginTop: 8,
  },
  aboutText: { fontSize: 12, color: COLORS.sub, lineHeight: 19, textAlign: 'center' },

  // ---- 模型选择弹窗 ----
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.card, borderRadius: 16, width: '100%',
    maxHeight: '70%', padding: 16, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  modalClose: { fontSize: 20, color: COLORS.muted, paddingHorizontal: 4 },
  modalLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, justifyContent: 'center' },
  modalLoadingText: { fontSize: 13, color: COLORS.sub },
  modalEmpty: { fontSize: 13, color: COLORS.sub, textAlign: 'center', paddingVertical: 20, lineHeight: 20 },
  modalList: { maxHeight: 400 },
  modelItem: {
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  modelItemText: { fontSize: 14, color: COLORS.ink, fontWeight: '500' },
  modelItemOwner: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
});
