@echo off
chcp 65001 >nul
title Life OS Desktop
echo ================================
echo   Life OS 桌面版启动中...
echo ================================
echo.
echo 后端服务: http://localhost:2456
echo 关闭此窗口即可退出
echo.
start "" http://localhost:2456
node server.js
pause
