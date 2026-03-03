#!/bin/bash
# Cloudflare Workers 一键部署脚本
# 用法: ./deploy-worker.sh

echo "🚀 开始部署留言板后端..."
echo ""

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "📦 安装 Cloudflare Wrangler..."
    npm install -g wrangler
fi

# 登录 Cloudflare
echo "🔑 请登录 Cloudflare（会打开浏览器）..."
wrangler login

# 进入 worker 目录
cd "$(dirname "$0")"

# 创建 KV 命名空间
echo ""
echo "🗄️  创建 KV 数据库..."
KV_OUTPUT=$(wrangler kv:namespace create "GUESTBOOK_KV" 2>&1)
echo "$KV_OUTPUT"

# 提取 KV ID
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+')

if [ -z "$KV_ID" ]; then
    echo "⚠️  可能是 KV 已存在，尝试查找现有 ID..."
    # 列出所有 KV namespace
    wrangler kv:namespace list
    echo ""
    echo "请从上面找到 GUESTBOOK_KV 的 id，手动更新 wrangler.toml"
    exit 1
fi

# 更新 wrangler.toml
sed -i.bak "s/你的_KV_ID_填在这里/$KV_ID/g" wrangler.toml

echo ""
echo "📝 已更新配置文件"

# 部署
echo ""
echo "🚀 部署 Worker..."
wrangler deploy

echo ""
echo "✅ 部署完成！"
echo ""
echo "请复制上面的网址（https://xxx.workers.dev）"
echo "然后告诉我，我帮你配置前端。"
