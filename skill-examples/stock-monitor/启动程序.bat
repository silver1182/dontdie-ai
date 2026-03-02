@echo off
chcp 65001 > nul
title 股票监控助手
echo ======================================
echo 🚀 股票监控助手 - 正在启动
echo ======================================
echo.

:: 检查Node.js
node -v > nul 2>&1
if errorlevel 1 (
    echo ⚠️  首次使用，正在安装运行环境...
    echo 请稍候，这可能需要几分钟...
    echo.
    
    :: 下载Node.js
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi' -OutFile 'node_installer.msi' -UseBasicParsing"
    
    echo 正在安装...
    start /wait msiexec /i node_installer.msi /qn /norestart
    del node_installer.msi
    
    echo ✅ 环境安装完成
    echo.
)

:: 检查依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在准备组件...
    call npm install --quiet
    echo ✅ 准备完成
    echo.
)

:: 启动GUI
echo 🌐 正在启动图形界面...
echo 浏览器即将自动打开...
echo.

node gui/server.js

pause
