// ============================================================
//  Life OS — 学习笔记新建/编辑弹窗（日记 / 感悟通用）
//  v3: 保存机制优化 — 仅在有实际变动时 debounce 1.5s 自动保存
//       键盘避让优化 — 光标始终可见
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, LayoutAnimation, UIManager, Platform,
  Keyboard, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingSheet from './KeyboardAvoidingSheet';
import { COLORS } from '../constants';
import { todayStr, uid } from '../utils/helpers';
import { embedNote } from '../utils/embeddings';
import { useApp } from '../store/AppContext';

// Android LayoutAnimation 开关
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AddNoteSheet({ visible, onClose, onSave, editItem, kind }) {
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [embedding, setEmbedding] = useState(false);

  // 自动保存状态
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const currentIdRef = useRef(null); // 记录当前编辑的 id（新建时首次自动保存后生成）
  const hasSavedRef = useRef(false); // 是否已经保存过至少一次
  const debounceTimerRef = useRef(null);
  const contentRef = useRef('');
  const titleRef = useRef('');
  const tagsRef = useRef('');
  const dateRef = useRef(todayStr());

  // 脏标记：跟踪用户是否实际修改了内容
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef('');
  const lastSavedTitleRef = useRef('');
  const lastSavedTagsRef = useRef('');
  const lastSavedDateRef = useRef('');

  // 键盘避让相关
  const scrollViewRef = useRef(null);
  const contentInputRef = useRef(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const isInsight = kind === 'insight';

  // 同步 ref
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { dateRef.current = date; }, [date]);

  // 检查当前内容是否与上次保存的内容不同
  const hasRealChanges = useCallback(() => {
    return contentRef.current !== lastSavedContentRef.current
      || titleRef.current !== lastSavedTitleRef.current
      || tagsRef.current !== lastSavedTagsRef.current
      || dateRef.current !== lastSavedDateRef.current;
  }, []);

  // 初始化/重置
  useEffect(() => {
    if (visible) {
      if (editItem) {
        const initDate = editItem.date || todayStr();
        const initTitle = editItem.title || '';
        const initContent = editItem.content || '';
        const initTags = Array.isArray(editItem.tags) ? editItem.tags.join(' ') : '';
        setDate(initDate);
        setTitle(initTitle);
        setContent(initContent);
        setTags(initTags);
        currentIdRef.current = editItem.id;
        hasSavedRef.current = true;
        // 记录初始值为「上次保存的内容」
        lastSavedContentRef.current = initContent;
        lastSavedTitleRef.current = initTitle;
        lastSavedTagsRef.current = initTags;
        lastSavedDateRef.current = initDate;
      } else {
        const initDate = todayStr();
        setDate(initDate);
        setTitle('');
        setContent('');
        setTags('');
        currentIdRef.current = null;
        hasSavedRef.current = false;
        lastSavedContentRef.current = '';
        lastSavedTitleRef.current = '';
        lastSavedTagsRef.current = '';
        lastSavedDateRef.current = initDate;
      }
      isDirtyRef.current = false;
      setSaveStatus('idle');
    }
  }, [editItem, visible, kind]);

  // 键盘事件：自动滚动到底部让光标可见
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => {
      setKeyboardVisible(true);
      // 延迟一点让布局完成后再滚动
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }, 150);
    };
    const onHide = () => {
      setKeyboardVisible(false);
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // 静默保存（不关闭弹窗）
  const silentSave = useCallback(() => {
    const c = contentRef.current.trim();
    if (!c) return; // 内容为空不保存

    const payload = {
      id: currentIdRef.current || uid(),
      date: dateRef.current,
      title: titleRef.current.trim(),
      content: c,
      type: isInsight ? 'insight' : 'diary',
      createdAt: editItem?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    if (isInsight) {
      payload.tags = tagsRef.current.split(/\s+/).filter(Boolean);
    }
    // 合并 editItem 的其他字段
    if (editItem) Object.assign(payload, { ...editItem, ...payload });

    currentIdRef.current = payload.id;
    hasSavedRef.current = true;
    isDirtyRef.current = false;

    // 更新「上次保存」快照
    lastSavedContentRef.current = contentRef.current;
    lastSavedTitleRef.current = titleRef.current;
    lastSavedTagsRef.current = tagsRef.current;
    lastSavedDateRef.current = dateRef.current;

    setSaveStatus('saving');

    onSave(payload);

    // 后台异步生成 embedding
    embedNote(payload, state.settings)
      .then(() => { /* 成功 */ })
      .catch((e) => console.warn('Embedding 生成失败:', e?.message || e));

    // 短暂延迟后显示「已保存」
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, [editItem, isInsight, onSave, state.settings]);

  // 用户输入变动时标记 dirty
  const handleContentChange = (text) => {
    setContent(text);
    isDirtyRef.current = true;
  };
  const handleTitleChange = (text) => {
    setTitle(text);
    isDirtyRef.current = true;
  };
  const handleTagsChange = (text) => {
    setTags(text);
    isDirtyRef.current = true;
  };
  const handleDateChange = (text) => {
    setDate(text);
    isDirtyRef.current = true;
  };

  // Debounce 自动保存：有实际变动后 1.5s 触发
  useEffect(() => {
    if (!visible) return;
    // 只有 dirty 时才启动 debounce
    if (!isDirtyRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current && hasRealChanges()) {
        silentSave();
      }
    }, 1500);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [content, title, tags, date, visible, silentSave, hasRealChanges]);

  // 手动保存按钮
  const handleSave = () => {
    if (!content.trim()) return;
    silentSave();
    onClose();
  };

  // 关闭时自动保存（仅在有未保存变动时）
  const handleClose = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (contentRef.current.trim() && hasRealChanges()) {
      silentSave();
    }
    onClose();
  };

  // 内容输入框获得焦点时滚动到可见
  const handleContentFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 200);
  };

  // 内容输入框内容改变时，如果键盘可见，确保滚动到底部
  const handleContentSelectionChange = () => {
    if (keyboardVisible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }, 50);
    }
  };

  // 保存状态文案
  const statusText = saveStatus === 'saving' ? '正在保存…' : saveStatus === 'saved' ? '已保存' : '';
  const statusColor = saveStatus === 'saving' ? COLORS.muted : saveStatus === 'saved' ? COLORS.success : COLORS.muted;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingSheet style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          {/* 固定头部 */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>
                {editItem ? '编辑' : '新建'}{isInsight ? '学习感悟' : '日记'}
              </Text>
              {statusText ? (
                <Text style={[styles.saveStatus, { color: statusColor }]}>{statusText}</Text>
              ) : null}
            </View>
          </View>

          {/* 可滚动内容区 */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>日期</Text>
            <TextInput
              value={date}
              onChangeText={handleDateChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />

            <Text style={styles.label}>标题（可选）</Text>
            <TextInput
              value={title}
              onChangeText={handleTitleChange}
              placeholder={isInsight ? '例如：React Hooks 心得' : '例如：今天的小确幸'}
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />

            {isInsight && (
              <>
                <Text style={styles.label}>标签（空格分隔）</Text>
                <TextInput
                  value={tags}
                  onChangeText={handleTagsChange}
                  placeholder="例如：前端 算法 英语"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </>
            )}

            <Text style={styles.label}>内容</Text>
            <TextInput
              ref={contentInputRef}
              value={content}
              onChangeText={handleContentChange}
              placeholder="写点什么…"
              placeholderTextColor={COLORS.muted}
              style={[styles.input, styles.contentInput]}
              multiline
              textAlignVertical="top"
              autoFocus
              scrollEnabled={false} // 让外层 ScrollView 负责滚动
              onFocus={handleContentFocus}
              onSelectionChange={handleContentSelectionChange}
            />
            {/* 底部留白防止内容被保存按钮或键盘遮挡 */}
            <View style={{ height: keyboardVisible ? 80 : 8 }} />
          </ScrollView>

          {/* 固定底部保存按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, !content.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!content.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{editItem ? '保存修改' : '保存'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    flex: 0,
  },
  // 头部（固定）
  header: { paddingHorizontal: 20, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.line, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  saveStatus: { fontSize: 12, fontWeight: '600' },
  // 可滚动区
  scrollArea: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 12 },
  // 表单
  label: { fontSize: 13, fontWeight: '600', color: COLORS.sub, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
  },
  contentInput: {
    minHeight: 160,
    lineHeight: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  // 固定底部
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: COLORS.line },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
