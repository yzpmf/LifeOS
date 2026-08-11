// ============================================================
//  Life OS — 学习记录页面
//  分为「日记本」和「学习感悟本」。
//  AI 回顾：嵌入向量检索 + LLM 总结（已完成）。
// ============================================================
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';
import { useApp } from '../store/AppContext';
import { useFeedback } from '../store/FeedbackContext';
import { fmtDate, todayStr, getLLMConfig } from '../utils/helpers';
import { deleteEmbedding, searchNotes, formatNotesContext, allNotesFromState } from '../utils/embeddings';
import AddNoteSheet from '../components/AddNoteSheet';

const TABS = [
  { key: 'diary', label: '日记本' },
  { key: 'insight', label: '学习感悟' },
];

const AI_SUGGESTIONS = [
  '我这周学了什么？',
  '这个月有什么学习感悟？',
  '我最近在研究什么？',
];

export default function LearnScreen() {
  const { state, dispatch } = useApp();
  const { confirm, showToast } = useFeedback();
  const { diary, insights, settings } = state;

  const [tab, setTab] = useState('diary');
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // AI 回顾状态
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiInput, setShowAiInput] = useState(false);

  const isInsight = tab === 'insight';
  const list = isInsight ? insights : diary;

  const sortedList = useMemo(
    () => [...list].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [list]
  );

  const allNotes = useMemo(() => allNotesFromState({ diary, insights }), [diary, insights]);

  const handleSave = (data) => {
    // 根据 id 是否已存在来决定 ADD 还是 UPDATE（支持自动保存场景）
    const exists = list.some((item) => item.id === data.id);
    if (exists) {
      dispatch({ type: isInsight ? 'UPDATE_INSIGHT' : 'UPDATE_DIARY', payload: data });
    } else {
      dispatch({ type: isInsight ? 'ADD_INSIGHT' : 'ADD_DIARY', payload: data });
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: `删除${isInsight ? '感悟' : '日记'}`,
      message: `确定删除「${item.title || item.date}」的内容？`,
      confirmText: '删除',
      destructive: true,
    });
    if (ok) {
      dispatch({ type: isInsight ? 'DELETE_INSIGHT' : 'DELETE_DIARY', payload: item.id });
      deleteEmbedding(item.id).catch((e) => console.warn('删除 embedding 失败:', e));
      showToast('已删除', 'success');
    }
  };

  // ---- AI 回顾：检索 + LLM 总结 ----
  const handleAiAsk = async (question) => {
    const q = question.trim();
    if (!q || aiLoading) return;

    const llmCfg = getLLMConfig(settings);
    if (!llmCfg.apiKey) {
      setAiResult({ error: '请先在「我的」页面的「语言模型」中配置 API Key。' });
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    setShowAiInput(false);

    try {
      // Step 1: 嵌入向量语义检索
      const results = await searchNotes(q, allNotes, settings, { topK: 5, threshold: 0.2 });
      const context = formatNotesContext(results, {
        maxChars: 3000,
        header: '以下是从用户日记/学习笔记中召回的相关片段：',
      });

      // Step 2: 调用 LLM 总结
      const systemPrompt = context
        ? `你是 Life OS 的学习助手。请根据用户日记和学习感悟中召回的内容回答用户的问题。
严格按照以下格式回复（用 Markdown）：

## 📝 回顾总结
（基于笔记内容，回答用户的问题，2-5句话概括）

## 📖 相关记录
（列出每条相关记录：日期 + 关键内容摘要，每条一行，格式为 - YYYY-MM-DD：摘要）

如果笔记中没有相关内容，诚实告知。用简洁友好的中文。`
        : `你是 Life OS 的学习助手。用户目前还没有记录任何日记或学习感悟。
请友好地鼓励用户开始记录，告诉他们记录越多，AI 越能帮助他们回顾和反思学习过程。`;

      const messages = [
        { role: 'system', content: systemPrompt + (context ? '\n\n--- 召回内容 ---\n' + context : '') },
        { role: 'user', content: q },
      ];

      const url = `${llmCfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmCfg.apiKey}` },
        body: JSON.stringify({ model: llmCfg.model, messages, temperature: 0.7, max_tokens: 800 }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`API 错误 (${resp.status}): ${errText.slice(0, 200)}`);
      }

      const data = await resp.json();
      setAiResult({
        answer: data.choices?.[0]?.message?.content || '未收到回复',
        sources: results.slice(0, 3),
      });
    } catch (err) {
      console.warn('AI 回顾失败:', err);
      setAiResult({ error: err.message || 'AI 回顾请求失败，请稍后重试' });
    } finally {
      setAiLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    for (const item of sortedList) {
      const key = item.date || todayStr();
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sortedList]);

  const clearAiResult = () => setAiResult(null);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>学习记录</Text>
            <Text style={styles.subtitle}>日记本 · 学习感悟</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditItem(null); setAdding(true); }} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>＋ 新建</Text>
          </TouchableOpacity>
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI 回顾 */}
        <View style={styles.aiBanner}>
          <View style={styles.aiBannerHeader}>
            <Text style={styles.aiBannerTitle}>💡 AI 回顾</Text>
            <TouchableOpacity
              style={styles.aiAskBtn}
              onPress={() => { setShowAiInput(!showAiInput); if (aiResult) clearAiResult(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.aiAskBtnText}>{showAiInput ? '收起 ▴' : '问 AI'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiBannerText}>
            AI 会检索你的日记和感悟，用嵌入向量找到相关内容，再帮你总结。
          </Text>

          {/* AI 输入区 */}
          {showAiInput && (
            <View style={styles.aiInputRow}>
              <TextInput
                value={aiQuestion}
                onChangeText={setAiQuestion}
                placeholder="例如：我这周学了什么？"
                placeholderTextColor={COLORS.muted}
                style={styles.aiTextInput}
                returnKeyType="search"
                onSubmitEditing={() => handleAiAsk(aiQuestion)}
                editable={!aiLoading}
              />
              <TouchableOpacity
                style={[styles.aiSendBtn, (!aiQuestion.trim() || aiLoading) && styles.aiSendBtnDisabled]}
                onPress={() => handleAiAsk(aiQuestion)}
                disabled={!aiQuestion.trim() || aiLoading}
              >
                <Text style={styles.aiSendBtnText}>提问</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 快捷提问 */}
          <View style={styles.aiSuggestions}>
            {AI_SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.aiChip}
                onPress={() => handleAiAsk(s)}
                disabled={aiLoading}
              >
                <Text style={styles.aiChipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI 加载中 */}
          {aiLoading && (
            <View style={styles.aiLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.aiLoadingText}>正在检索你的笔记并分析...</Text>
            </View>
          )}

          {/* AI 结果 */}
          {aiResult && !aiLoading && (
            <View style={styles.aiResultBox}>
              <View style={styles.aiResultHeader}>
                <Text style={styles.aiResultTitle}>🤖 AI 回复</Text>
                <TouchableOpacity onPress={clearAiResult}>
                  <Text style={styles.aiResultClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {aiResult.error ? (
                <Text style={styles.aiResultError}>{aiResult.error}</Text>
              ) : (
                <Text style={styles.aiResultText}>{aiResult.answer}</Text>
              )}
            </View>
          )}
        </View>

        {/* 列表 */}
        <View style={styles.list}>
          {sortedList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>{isInsight ? '还没有学习感悟' : '日记本是空的'}</Text>
              <Text style={styles.emptyHint}>记录一下今天的收获或心情吧</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { setEditItem(null); setAdding(true); }}>
                <Text style={styles.emptyBtnText}>写一条</Text>
              </TouchableOpacity>
            </View>
          ) : (
            grouped.map(([date, items]) => (
              <View key={date} style={styles.group}>
                <Text style={styles.groupDate}>{fmtDate(date)}</Text>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    onPress={() => { setEditItem(item); setAdding(true); }}
                    onLongPress={() => handleDelete(item)}
                    activeOpacity={0.8}
                  >
                    {item.title ? <Text style={styles.cardTitle}>{item.title}</Text> : null}
                    <Text style={styles.cardContent} numberOfLines={4}>{item.content}</Text>
                    {isInsight && Array.isArray(item.tags) && item.tags.length > 0 ? (
                      <View style={styles.tagRow}>
                        {item.tags.map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AddNoteSheet
        visible={adding}
        onClose={() => { setAdding(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        kind={tab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line, padding: 3, marginBottom: 14,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.accent },
  tabText: { fontSize: 13, color: COLORS.sub, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  // ---- AI Banner ----
  aiBanner: {
    backgroundColor: COLORS.accentSoft, borderRadius: 14, borderWidth: 1, borderColor: COLORS.accent + '30',
    padding: 14, marginBottom: 16, gap: 10,
  },
  aiBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  aiBannerText: { fontSize: 12, color: COLORS.sub, lineHeight: 18 },
  aiAskBtn: {
    backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  aiAskBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // AI 输入行
  aiInputRow: { flexDirection: 'row', gap: 8 },
  aiTextInput: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: COLORS.ink,
  },
  aiSendBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  aiSendBtnDisabled: { backgroundColor: COLORS.line },
  aiSendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // 快捷提问
  aiSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  aiChip: {
    backgroundColor: COLORS.card, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent + '30',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  aiChipText: { fontSize: 12, color: COLORS.accent, fontWeight: '500' },

  // AI 加载
  aiLoadingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 10, padding: 12, marginTop: 4,
  },
  aiLoadingText: { fontSize: 13, color: COLORS.sub },

  // AI 结果
  aiResultBox: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent + '30',
    padding: 12, marginTop: 4, gap: 8,
  },
  aiResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiResultTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  aiResultClose: { fontSize: 16, color: COLORS.muted, paddingHorizontal: 4 },
  aiResultText: { fontSize: 13, color: COLORS.ink, lineHeight: 21 },
  aiResultError: { fontSize: 13, color: COLORS.danger, lineHeight: 20 },

  // ---- 列表 ----
  list: { gap: 14 },
  emptyBox: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line,
    padding: 36, alignItems: 'center',
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  emptyHint: { fontSize: 12, color: COLORS.muted, marginTop: 4, marginBottom: 16 },
  emptyBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  group: { gap: 8 },
  groupDate: { fontSize: 12, color: COLORS.sub, fontWeight: '700', marginBottom: 2 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line,
    padding: 14, gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  cardContent: { fontSize: 14, color: COLORS.sub, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: COLORS.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: COLORS.accent, fontWeight: '600' },
});
