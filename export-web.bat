@echo off
echo ================================
echo  Life OS Web Export
echo ================================
cd /d "D:\一些项目\Life OS\LifeOSApp"
echo.
echo Installing dependencies...
call npm install
echo.
echo Building web version...
call npx expo export --platform web
echo.
echo Build complete! Check the dist/ folder.
pause
