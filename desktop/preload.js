// ============================================================
//  Life OS Desktop — Electron 预加载脚本
//  安全暴露 API 给渲染进程
// ============================================================
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('lifeosAPI', {
  platform: 'desktop',
  version: '1.0.0',
});
