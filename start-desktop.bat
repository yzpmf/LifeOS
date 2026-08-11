@echo off
chcp 65001 >nul
setlocal

:: 自动寻找 Node.js（优先 D 盘安装路径）
set NODE_DIR=D:\Apps\NodeJS
if not exist "%NODE_DIR%\node.exe" set NODE_DIR=D:\apps\New Folder
if not exist "%NODE_DIR%\node.exe" (
  echo [错误] 找不到 node.exe，请检查 Node.js 安装路径
  pause
  exit /b 1
)
set PATH=%NODE_DIR%;%PATH%

:: 启动后端（后台隐藏窗口）
echo [1/2] 启动 Life OS 后端...
start /b "" node "%~dp0desktop\server.js" >"%~dp0desktop\server.log" 2>&1

:: 等待后端就绪
echo [2/2] 等待后端就绪...
:wait_loop
timeout /t 1 /nobreak >nul
node -e "require('http').get('http://localhost:2456/api/ping', r => {process.exit(r.statusCode===200?0:1)}).on('error', () => process.exit(1))" >nul 2>&1
if errorlevel 1 goto wait_loop

:: 直接打开浏览器访问桌面版
echo.
echo Life OS 桌面版已启动：http://localhost:2456
start msedge http://localhost:2456

pause
