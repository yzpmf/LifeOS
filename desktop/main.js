// ============================================================
//  Life OS 桌面版 — Electron 主进程
//
//  这个文件是整个桌面软件的"大脑"，负责：
//    1. 启动后端服务（server.js）
//    2. 创建窗口并加载界面（index.html）
//    3. 处理窗口关闭等系统事件
// ============================================================

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const serverApp = require('./server');

// ---- 启动后端服务 ----
let serverInstance = null;

function startServer() {
  return new Promise((resolve) => {
    const express = serverApp.app;
    const PORT = serverApp.PORT;
    serverInstance = express.listen(PORT, '0.0.0.0', () => {
      console.log('Life OS backend started on port', PORT);
      resolve();
    });
  });
}

// ---- 创建窗口 ----
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'Life OS',
    // 无边框窗口可选（暂时不用，保持标准窗口栏）
    // frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载本地 HTML 文件
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 开发时打开 DevTools（正式版注释掉这行）
  // mainWindow.webContents.openDevTools();

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- Electron 生命周期 ----
app.whenReady().then(async () => {
  // 先启动后端，再开窗口
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 关窗口时停掉后端
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
});
