#!/bin/bash
# 股票监控 - Mac/Linux 一键启动脚本

echo "======================================"
echo "🚀 股票监控助手 - 一键启动"
echo "======================================"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "⚠️  检测到未安装Node.js，正在自动安装..."
    
    # 检测系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Mac
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "请先安装 Homebrew: https://brew.sh"
            exit 1
        fi
    else
        # Linux
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    echo "✅ Node.js 安装完成"
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo "✅ 依赖安装完成"
fi

# 检查配置文件
if [ ! -f "config/stocks.json" ]; then
    echo "⚙️  首次运行，正在创建配置文件..."
    cp config/stocks.json.example config/stocks.json
    echo "✅ 配置文件已创建"
    echo ""
    echo "📝 请编辑 config/stocks.json 填入你的股票信息"
    echo "   可以用文本编辑器打开修改"
    echo ""
    read -p "按回车键打开配置文件..."
    
    # 尝试用默认编辑器打开
    if command -v code &> /dev/null; then
        code config/stocks.json
    elif command -v nano &> /dev/null; then
        nano config/stocks.json
    else
        open config/stocks.json
    fi
    
    echo ""
    read -p "配置完成后按回车键继续..."
fi

echo ""
echo "🟢 正在启动股票监控..."
echo "   按 Ctrl+C 停止"
echo ""

node scripts/monitor.js
