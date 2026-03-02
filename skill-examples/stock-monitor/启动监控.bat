@echo off
chcp 65001 > nul
title 股票监控助手
echo ======================================
echo 🚀 股票监控助手 - 一键启动
echo ======================================
echo.

:: 检查Node.js
node -v > nul 2>&1
if errorlevel 1 (
    echo ⚠️  首次使用，需要安装运行环境...
    echo.
    echo 正在下载安装程序...
    
    :: 下载Node.js安装包
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi' -OutFile 'node_installer.msi'"
    
    echo 正在安装...
    start /wait msiexec /i node_installer.msi /qn
    del node_installer.msi
    
    echo ✅ 环境安装完成
    echo.
    pause
)

:: 检查依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装组件...
    call npm install
    echo ✅ 组件安装完成
    echo.
)

:: 检查配置文件
if not exist "config\stocks.json" (
    echo ⚙️  首次运行，正在创建配置文件...
    copy config\stocks.json.example config\stocks.json
    echo ✅ 配置文件已创建
    echo.
    echo 📝 请编辑 config\stocks.json 填入你的股票信息
    echo    右键点击文件 → 打开方式 → 记事本
    echo.
    start config\stocks.json
    pause
)

echo.
echo 🟢 正在启动股票监控...
echo    不要关闭这个窗口！最小化即可
echo    按 Ctrl+C 停止
echo.

node scripts\monitor.js

pause
