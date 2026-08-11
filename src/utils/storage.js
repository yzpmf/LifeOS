// ============================================================
//  Life OS — 存储适配器（支持无感多端同步）
//
//  设计目标：
//    - 手机和电脑使用同一个数据源（电脑后端）
//    - 后端在线时，所有读写实时走 API
//    - 后端不在线时，写入本地并标记待同步，上线后自动合并
//    - 冲突策略：last-write-wins（单人使用，简单稳定）
// ============================================================

import { Platform } from 'react-native';

let AsyncStorage = null;
if (Platform.OS !== 'web') {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch {
    // native module 加载失败（非常规）
  }
}

const isNative = Platform.OS !== 'web' && !!AsyncStorage;
const isWeb = Platform.OS === 'web' || (!isNative && typeof window !== 'undefined');

// 配置键（直接存在 AsyncStorage，避免循环依赖）
const CFG_KEY = '@lifeos:desktopUrl';
const DEFAULT_API_BASE = 'http://localhost:2456/api';

let _cachedBase = null;

// 获取配置的桌面端地址
async function getApiBase() {
  if (_cachedBase) return _cachedBase;
  try {
    if (AsyncStorage) {
      const url = await AsyncStorage.getItem(CFG_KEY);
      _cachedBase = url || DEFAULT_API_BASE;
    } else {
      _cachedBase = DEFAULT_API_BASE;
    }
  } catch {
    _cachedBase = DEFAULT_API_BASE;
  }
  return _cachedBase;
}

export async function setDesktopUrl(url) {
  const trimmed = (url || '').trim();
  const normalized = trimmed.endsWith('/api') ? trimmed : trimmed.replace(/\/$/, '') + '/api';
  _cachedBase = normalized;
  if (AsyncStorage) {
    await AsyncStorage.setItem(CFG_KEY, normalized);
  } else if (isWeb) {
    localStorage.setItem(CFG_KEY, normalized);
  }
  return normalized;
}

export async function getDesktopUrl() {
  const base = await getApiBase();
  // 用户看到的地址去掉 /api
  return base.replace(/\/api$/, '');
}

// 后端在线状态缓存
let _backendOnline = null;
let _lastCheckAt = 0;
const CHECK_TTL = 3000; // 3 秒内复用检测结果

export async function checkBackendOnline(force = false) {
  const now = Date.now();
  if (!force && _backendOnline !== null && now - _lastCheckAt < CHECK_TTL) {
    return _backendOnline;
  }
  const base = await getApiBase();
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const res = await fetch(`${base}/ping`, { method: 'GET', signal: c.signal });
    clearTimeout(t);
    _backendOnline = res.ok;
  } catch {
    _backendOnline = false;
  }
  _lastCheckAt = now;
  return _backendOnline;
}

export function resetBackendCache() {
  _backendOnline = null;
  _lastCheckAt = 0;
}

// 本地存储键：记录哪些 key 有待同步数据
const PENDING_SYNC_KEY = '@lifeos:pendingSync';

async function getPendingKeys() {
  try {
    const raw = AsyncStorage ? await AsyncStorage.getItem(PENDING_SYNC_KEY) : localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function addPendingKey(key) {
  const keys = await getPendingKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    await (AsyncStorage
      ? AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(keys))
      : Promise.resolve(localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(keys))));
  }
}

async function removePendingKey(key) {
  const keys = (await getPendingKeys()).filter((k) => k !== key);
  await (AsyncStorage
    ? AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(keys))
    : Promise.resolve(localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(keys))));
}

// key 转换：lifeos.tasks.v1 -> tasks
function toShortKey(key) {
  return key.replace(/^lifeos\./, '').replace(/\.v1$/, '');
}

// API 封装
async function apiRequest(method, shortKey, body) {
  const base = await getApiBase();
  const res = await fetch(`${base}/${shortKey}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${shortKey} failed: ${res.status}`);
  return method === 'DELETE' ? { ok: true } : res.json();
}

async function apiGet(shortKey) {
  return apiRequest('GET', shortKey);
}

async function apiSet(shortKey, value) {
  return apiRequest('POST', shortKey, value);
}

async function localGet(key) {
  if (AsyncStorage) return AsyncStorage.getItem(key);
  if (isWeb) return localStorage.getItem(key);
  return null;
}

async function localSet(key, value) {
  if (AsyncStorage) return AsyncStorage.setItem(key, value);
  if (isWeb) return localStorage.setItem(key, value);
}

async function localRemove(key) {
  if (AsyncStorage) return AsyncStorage.removeItem(key);
  if (isWeb) return localStorage.removeItem(key);
}

// ============================================================
//  对外统一接口
// ============================================================

/**
 * 获取存储数据（JSON 字符串或 null）
 */
export async function storageGet(key) {
  const online = await checkBackendOnline();
  if (online) {
    try {
      const data = await apiGet(toShortKey(key));
      return JSON.stringify(data);
    } catch (e) {
      console.warn('storageGet backend failed, fallback local', e.message);
    }
  }
  return localGet(key);
}

/**
 * 设置存储数据（value 为 JSON 字符串）
 */
export async function storageSet(key, value) {
  const online = await checkBackendOnline();
  if (online) {
    try {
      await apiSet(toShortKey(key), JSON.parse(value));
      await removePendingKey(key);
      return;
    } catch (e) {
      console.warn('storageSet backend failed, write local', e.message);
    }
  }
  await localSet(key, value);
  await addPendingKey(key);
}

/**
 * 批量获取
 */
export async function storageMultiGet(keys) {
  const online = await checkBackendOnline();
  if (online) {
    const results = await Promise.all(
      keys.map(async (key) => {
        try {
          const data = await apiGet(toShortKey(key));
          return [key, JSON.stringify(data)];
        } catch {
          return [key, null];
        }
      })
    );
    return results;
  }
  if (AsyncStorage && AsyncStorage.multiGet) {
    return AsyncStorage.multiGet(keys);
  }
  return keys.map((k) => [k, localStorage.getItem(k)]);
}

/**
 * 批量设置
 */
export async function storageMultiSet(pairs) {
  const online = await checkBackendOnline();
  if (online) {
    await Promise.all(
      pairs.map(async ([key, value]) => {
        try {
          await apiSet(toShortKey(key), JSON.parse(value));
          await removePendingKey(key);
        } catch {
          await localSet(key, value);
          await addPendingKey(key);
        }
      })
    );
    return;
  }
  if (AsyncStorage && AsyncStorage.multiSet) {
    await AsyncStorage.multiSet(pairs);
  } else {
    pairs.forEach(([k, v]) => localStorage.setItem(k, v));
  }
  await Promise.all(pairs.map(([key]) => addPendingKey(key)));
}

/**
 * 删除数据
 */
export async function storageRemove(key) {
  const online = await checkBackendOnline();
  if (online) {
    try {
      await apiRequest('DELETE', toShortKey(key));
      await removePendingKey(key);
      await localRemove(key);
      return;
    } catch (e) {
      console.warn('storageRemove backend failed', e.message);
    }
  }
  await localRemove(key);
  await addPendingKey(key);
}

// ============================================================
//  同步控制
// ============================================================

/**
 * 手动触发：把本地待同步数据推送到后端
 * 返回 { pushedKeys, pulledKeys, conflicts }
 */
export async function syncPendingToBackend() {
  const online = await checkBackendOnline();
  if (!online) return { ok: false, reason: 'backend_offline', pushedKeys: [], pulledKeys: [] };

  const pendingKeys = await getPendingKeys();
  const pushedKeys = [];
  const pulledKeys = [];

  for (const key of pendingKeys) {
    const localValue = await localGet(key);
    if (localValue !== null) {
      try {
        await apiSet(toShortKey(key), JSON.parse(localValue));
        pushedKeys.push(key);
      } catch (e) {
        console.warn('sync push failed for', key, e.message);
        continue;
      }
    }
    await removePendingKey(key);
  }

  // 同时从后端拉取所有已知 key 的最新数据
  const ALL_KEYS = [
    'lifeos.tasks.v1', 'lifeos.courses.v1', 'lifeos.habits.v1',
    'lifeos.habitRecords.v1', 'lifeos.settings.v1', 'lifeos.chatHistory.v1',
    'lifeos.plans.v1', 'lifeos.diary.v1', 'lifeos.insights.v1',
  ];
  for (const key of ALL_KEYS) {
    try {
      const remote = await apiGet(toShortKey(key));
      await localSet(key, JSON.stringify(remote));
      pulledKeys.push(key);
    } catch (e) {
      console.warn('sync pull failed for', key, e.message);
    }
  }

  return { ok: true, pushedKeys, pulledKeys };
}

/**
 * 获取当前同步状态信息
 */
export async function getSyncStatus() {
  const online = await checkBackendOnline();
  const pendingKeys = await getPendingKeys();
  const desktopUrl = await getDesktopUrl();
  return {
    online,
    desktopUrl,
    pendingCount: pendingKeys.length,
    pendingKeys,
  };
}
