// ============================================================
//  Life OS 桌面版 — 后端服务
//
//  作用：一个轻量级 HTTP 服务器，负责：
//    1. 存取数据（JSON 文件存在用户数据目录）
//    2. 提供 API 给前端界面调用
//    3. 被 Electron 主进程启动，用户看不到命令行窗口
// ============================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---- 配置 ----
const PORT = 2456;

// 数据目录：放在系统标准位置（Win: %LOCALAPPDATA%/lifeos-data）
const DATA_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), 'lifeos-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// 支持的数据 key
const DATA_KEYS = ['tasks', 'courses', 'habits', 'habitRecords', 'settings', 'chatHistory', 'plans', 'diary', 'insights'];
const defaults = { tasks:[], courses:[], habits:[], habitRecords:{}, settings:{}, chatHistory:[], plans:{}, diary:[], insights:[] };

// ---- 文件读写工具 ----
function dataPath(key) { return path.join(DATA_DIR, key + '.json'); }

function readData(key) {
  try {
    return JSON.parse(fs.readFileSync(dataPath(key), 'utf-8'));
  } catch {
    return Array.isArray(defaults[key]) ? [] : {};
  }
}

function writeData(key, data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(dataPath(key), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('write error:', e.message);
    return false;
  }
}

// ---- 获取局域网 IP（方便手机连接）----
function getLanIps() {
  const ips = [];
  for (const [, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
    }
  }
  return ips;
}

// ---- HTTP 服务器 ----
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 健康检查（附带局域网 IP，方便手机发现）
app.get('/api/ping', (_r, res) => res.json({ ok: true, time: new Date().toISOString(), lanIps: getLanIps() }));

// 读取单个数据
app.get('/api/:key', (req, res) => {
  if (!DATA_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Unknown key' });
  res.json(readData(req.params.key));
});

// 写入单个数据（全量替换）
app.post('/api/:key', (req, res) => {
  if (!DATA_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Unknown key' });
  res.json({ ok: writeData(req.params.key, req.body) });
});

// 清空单个数据
app.delete('/api/:key', (req, res) => {
  if (!DATA_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Unknown key' });
  const empty = Array.isArray(defaults[req.params.key]) ? [] : {};
  res.json({ ok: writeData(req.params.key, empty) });
});

// 批量拉取
app.post('/api/sync/pull', (req, res) => {
  const keys = req.body.keys || DATA_KEYS;
  const result = {};
  for (const key of keys) {
    if (DATA_KEYS.includes(key)) result[key] = readData(key);
  }
  res.json(result);
});

// 批量推送
app.post('/api/sync/push', (req, res) => {
  const result = {};
  for (const key of DATA_KEYS) {
    if (req.body[key] !== undefined) result[key] = writeData(key, req.body[key]);
  }
  res.json({ ok: true, result });
});

// 同步状态
app.get('/api/sync/status', (_r, res) => {
  const status = {};
  for (const key of DATA_KEYS) {
    try {
      const st = fs.statSync(dataPath(key));
      status[key] = { updatedAt: st.mtime.toISOString(), size: st.size };
    } catch {
      status[key] = { updatedAt: null, size: 0 };
    }
  }
  res.json({ ok: true, status, time: new Date().toISOString() });
});

// ---- 静态文件服务（浏览器访问时托管 index.html + app.js）----
app.use(express.static(__dirname));

// ---- 导出（供 Electron main.js 调用）----
module.exports = { app, PORT, getLanIps, DATA_DIR };

// 如果直接用 node 运行（开发调试），自己启动监听
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLanIps();
    console.log(`Life OS server @ http://localhost:${PORT}`);
    if (ips.length) console.log(`LAN access: http://${ips[0]}:${PORT}`);
  });
}
