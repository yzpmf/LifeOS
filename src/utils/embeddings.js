// ============================================================
//  Life OS — 笔记/日记 嵌入向量服务（本地优先）
//  1. 调用云端 embedding API 生成向量
//  2. 把向量缓存到 AsyncStorage
//  3. 用纯 JS 余弦相似度检索，支持简单重排序
//  依赖：只调用 OpenAI/Silicon/DeepSeek 等标准 embedding API
// ============================================================

import { storageGet, storageSet, storageRemove } from './storage';
import {
  getEmbeddingConfig,
  cosineSimilarity,
  rerankNotes,
  noteForEmbedding,
  splitTextIntoChunks,
} from './helpers';

const EMBEDDING_STORAGE_KEY = 'lifeos.embeddings.v1';

/** 统一错误包装：让用户知道是哪一步出错 */
export class EmbeddingError extends Error {
  constructor(step, original) {
    super(`[embedding:${step}] ${original?.message || original || 'unknown'}`);
    this.step = step;
  }
}

/** 从 AsyncStorage 加载所有向量缓存 */
export async function loadEmbeddings() {
  try {
    const raw = await storageGet(EMBEDDING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('加载 embedding 缓存失败', e);
    return {};
  }
}

/** 保存向量缓存 */
export async function saveEmbeddings(map) {
  try {
    await storageSet(EMBEDDING_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('保存 embedding 缓存失败', e);
  }
}

/** 为单条笔记生成 embedding 并缓存 */
export async function embedNote(note, settings, opts = {}) {
  const { force = false } = opts;
  const cache = await loadEmbeddings();
  const noteId = note.id;
  const updatedAt = note.updatedAt || note.createdAt;
  const cached = cache[noteId];

  // 缓存命中且没更新过，直接返回
  if (!force && cached && cached.updatedAt === updatedAt && Array.isArray(cached.vector)) {
    return cached.vector;
  }

  const text = noteForEmbedding(note);
  if (!text.trim()) return null;

  const vector = await fetchEmbedding(text, settings);
  cache[noteId] = {
    vector,
    model: getEmbeddingConfig(settings).model,
    updatedAt,
  };
  await saveEmbeddings(cache);
  return vector;
}

/** 批量为多条笔记生成 embedding */
export async function embedNotes(notes, settings, onProgress) {
  const vectors = [];
  for (let i = 0; i < notes.length; i++) {
    const v = await embedNote(notes[i], settings);
    vectors.push({ note: notes[i], vector: v });
    if (onProgress) onProgress(i + 1, notes.length);
  }
  return vectors;
}

/** 删除指定笔记的 embedding 缓存 */
export async function deleteEmbedding(noteId) {
  const cache = await loadEmbeddings();
  if (cache[noteId]) {
    delete cache[noteId];
    await saveEmbeddings(cache);
  }
}

/** 清空所有 embedding 缓存 */
export async function clearEmbeddings() {
  await storageRemove(EMBEDDING_STORAGE_KEY);
}

/** 测试 embedding API 是否可用 */
export async function testEmbeddingConnection(settings) {
  const vector = await fetchEmbedding('测试连接', settings, { noCache: true });
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new EmbeddingError('test', '返回向量为空');
  }
  return vector.length;
}

/** 调用 embedding API */
export async function fetchEmbedding(input, settings, opts = {}) {
  const { apiKey, baseUrl, model } = getEmbeddingConfig(settings);
  if (!apiKey || !baseUrl) {
    throw new EmbeddingError('config', '缺少 embedding API 配置（API Key 或 Base URL）');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/embeddings`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: input.slice(0, 8000),
      encoding_format: 'float',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new EmbeddingError('api', `HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new EmbeddingError('parse', 'API 返回格式不符合预期');
  }
  return vector;
}

/** 检索与 query 最相关的笔记/日记 */
export async function searchNotes(query, allNotes, settings, opts = {}) {
  const { topK = 5, threshold = 0.25, withRerank = true } = opts;
  if (!query || !query.trim() || !allNotes || allNotes.length === 0) return [];

  const queryVector = await fetchEmbedding(query, settings);
  const cache = await loadEmbeddings();

  // 优先用缓存的向量；没缓存的现场 embed（但不写入缓存，避免污染）
  const candidates = [];
  for (const note of allNotes) {
    const cached = cache[note.id];
    const ts = note.updatedAt || note.createdAt;
    let vector = cached && cached.updatedAt === ts ? cached.vector : null;
    if (!vector) {
      try {
        vector = await embedNote(note, settings);
      } catch (e) {
        console.warn('embedNote failed', note.id, e.message);
        continue;
      }
    }
    if (!vector) continue;
    candidates.push({
      ...note,
      vector,
      score: cosineSimilarity(queryVector, vector),
    });
  }

  const filtered = candidates
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const final = withRerank ? rerankNotes(filtered, query) : filtered;
  return final.slice(0, topK).map((r) => ({
    id: r.id,
    type: r.type || 'note',
    date: r.date,
    title: r.title,
    content: r.content,
    tags: r.tags,
    score: r.score,
    rerankScore: r.rerankScore,
    text: noteForEmbedding(r), // 给 AI 用的完整文本
  }));
}

/** 把检索结果格式化成系统 prompt 用的上下文 */
export function formatNotesContext(results, opts = {}) {
  const { maxChars = 3000, header = '以下是用户过往的相关笔记/日记片段：' } = opts;
  if (!results || results.length === 0) return '';

  let text = header + '\n\n';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const item = `--- 片段 ${i + 1} ---\n日期：${r.date || '未知'}\n${r.text}\n\n`;
    if (text.length + item.length > maxChars) break;
    text += item;
  }
  return text.trim();
}

/** 把日记/感悟合并成统一的 note 数组 */
export function allNotesFromState(state) {
  const diary = (state.diary || []).map((d) => ({ ...d, type: 'diary' }));
  const insights = (state.insights || []).map((i) => ({ ...i, type: 'insight' }));
  return [...diary, ...insights].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
  );
}
