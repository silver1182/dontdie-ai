# Cloudflare Workers 留言板部署指南

## 目标
把现在的单机版留言板升级为**多人共享版**，并实现可选的**邮件通知**。

---

## 第一步：部署后端（Cloudflare Workers）

### 1.1 准备工作
```bash
# 安装 Node.js（如果还没装）
# 然后安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 1.2 创建 KV 存储
```bash
cd cf-worker

# 创建 KV 命名空间
wrangler kv:namespace create "GUESTBOOK_KV"
```

会输出类似：
```
{ binding = "GUESTBOOK_KV", id = "a1b2c3d4e5f6..." }
```

把 `id` 复制到 `wrangler.toml` 里替换 `你的_KV_ID_填在这里`。

### 1.3 部署后端
```bash
wrangler deploy
```

成功后会显示 URL：
```
https://dontdie-guestbook.xxx.workers.dev
```

**复制这个 URL，下一步要用。**

---

## 第二步：配置前端

### 2.1 修改 API 地址
打开 `guestbook-api.js`，把第一行改成你的 Workers 地址：

```javascript
const API_BASE_URL = 'https://dontdie-guestbook.xxx.workers.dev';
```

### 2.2 修改 index.html
在 `index.html` 里：

1. **删除**原来的 `guestbook-api.js` 引用（如果有的话）
2. **添加**新的 API 模块：

```html
<script src="guestbook-api.js"></script>
```

3. **修改表单提交按钮**：

把原来的：
```html
<button onclick="submitGuestbook()">提交留言</button>
```

改成：
```html
<button onclick="submitGuestbookAPI()">提交留言</button>
```

4. **修改初始化**：

把原来的：
```javascript
initGuestbook();
renderGuestbook();
```

改成：
```javascript
initGuestbookAPI();
```

---

## 第三步：测试

### 3.1 本地测试（可选）
```bash
cd cf-worker
wrangler dev
```

然后浏览器打开 `http://localhost:8787`，测试 API 是否正常。

### 3.2 部署测试
1. 提交代码到 GitHub
2. 等待 GitHub Pages 部署
3. 打开网站，测试留言功能
4. 换一台手机/电脑，看能否看到刚才的留言

---

## 第四步：配置邮件通知（可选）

### 4.1 注册 Resend
1. 访问 https://resend.com
2. 用 GitHub 账号登录
3. 获取 API Key

### 4.2 配置环境变量
```bash
cd cf-worker

# 设置 Resend API Key
wrangler secret put RESEND_API_KEY
# 粘贴你的 API Key

# 设置通知邮箱
wrangler secret put NOTIFY_EMAIL
# 输入你的邮箱，如 silver1182@example.com
```

### 4.3 更新发件人地址
编辑 `index.js`，把 `noreply@yourdomain.com` 改成你在 Resend 验证过的域名。

### 4.4 重新部署
```bash
wrangler deploy
```

---

## 常见问题

### Q: 部署后访问出现 CORS 错误？
A: 修改 `index.js` 里的 `corsHeaders`，把 `*` 改成你的域名：
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://silver1182.github.io',
  // ...
};
```

### Q: 邮件收不到？
A: Resend 免费版需要用他们提供的测试域名，或验证你自己的域名。

### Q: 留言突然没了？
A: KV 数据是最终一致的，偶尔会有短暂延迟。如果一直为空，检查 Workers 日志：
```bash
wrangler tail
```

---

## 升级路线图

```
现在：localStorage（单机版）
  ↓
下一步：Cloudflare Workers（多人共享）
  ↓
以后：加实时功能（WebSocket / 轮询）
  ↓
以后：加管理员后台（删除留言、置顶）
```

---

## 费用说明

**全部免费！**

| 服务 | 免费额度 | 你的网站用量 |
|------|---------|-------------|
| Cloudflare Workers | 100,000 次/天 | < 1000 次/天 |
| Cloudflare KV | 100,000 读/天 | < 1000 读/天 |
| Resend | 100 封/天 | < 10 封/天 |

除非你的网站爆火（一天几千人留言），否则永远免费。
