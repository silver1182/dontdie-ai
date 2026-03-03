# Cloudflare Workers 留言板后端

## 功能
- 多人共享留言（数据存 Cloudflare KV）
- 支持 CORS（前端直接调用）
- 可选邮件通知（Resend）

## 部署步骤

### 1. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```
浏览器会打开授权页面，点击允许。

### 3. 创建 KV 命名空间
```bash
wrangler kv:namespace create "GUESTBOOK_KV"
```

复制输出中的 id，更新 `wrangler.toml` 里的 `id` 字段。

### 4. 配置环境变量（可选）
```bash
# 邮件通知（可选）
wrangler secret put RESEND_API_KEY
# 输入你的 Resend API Key

wrangler secret put NOTIFY_EMAIL
# 输入接收通知的邮箱，如 your@email.com
```

### 5. 部署
```bash
wrangler deploy
```

部署成功后，会输出类似：
```
https://your-worker.your-subdomain.workers.dev
```

### 6. 配置前端
把上面的 URL 填到前端的 `API_BASE_URL` 里。

## API 文档

### GET /api/messages
获取留言列表

**响应：**
```json
{
  "success": true,
  "messages": [
    {
      "id": "abc123",
      "name": "小明",
      "content": "你好！",
      "avatar": "🐱",
      "timestamp": 1709452800000
    }
  ],
  "total": 42
}
```

### POST /api/messages
提交新留言

**请求体：**
```json
{
  "name": "昵称",
  "content": "留言内容"
}
```

**响应：**
```json
{
  "success": true,
  "message": {
    "id": "abc123",
    "name": "昵称",
    "content": "留言内容",
    "avatar": "🐱",
    "timestamp": 1709452800000
  }
}
```

## 免费额度
- Workers：每天 100,000 次请求
- KV：每天 100,000 次读取，1,000 次写入
- 完全够用！
