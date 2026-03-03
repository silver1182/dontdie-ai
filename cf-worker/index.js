// Cloudflare Workers 后端代码 - 留言板 API
// 部署步骤见 README.md

// CORS 配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 生产环境建议改成你的域名
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /api/messages - 获取留言列表
      if (path === '/api/messages' && request.method === 'GET') {
        return await getMessages(env);
      }

      // POST /api/messages - 提交新留言
      if (path === '/api/messages' && request.method === 'POST') {
        return await postMessage(request, env);
      }

      // 404
      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  }
};

// 获取留言列表
async function getMessages(env) {
  try {
    // 从 KV 读取数据
    const data = await env.GUESTBOOK_KV.get('messages');
    const messages = data ? JSON.parse(data) : [];
    
    // 按时间倒序排列
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    // 只返回最近的50条
    const recentMessages = messages.slice(0, 50);
    
    return jsonResponse({ 
      success: true, 
      messages: recentMessages,
      total: messages.length 
    });
  } catch (error) {
    return jsonResponse({ error: 'Failed to fetch messages' }, 500);
  }
}

// 提交新留言
async function postMessage(request, env) {
  try {
    const body = await request.json();
    const { name, content } = body;

    // 验证输入
    if (!name || !content) {
      return jsonResponse({ error: 'Name and content are required' }, 400);
    }

    if (name.length > 20) {
      return jsonResponse({ error: 'Name too long (max 20 chars)' }, 400);
    }

    if (content.length > 500) {
      return jsonResponse({ error: 'Content too long (max 500 chars)' }, 400);
    }

    // 过滤危险内容（简单版）
    const cleanName = sanitize(name);
    const cleanContent = sanitize(content);

    // 创建新留言
    const newMessage = {
      id: generateId(),
      name: cleanName,
      content: cleanContent,
      avatar: getRandomAvatar(),
      timestamp: Date.now()
    };

    // 读取现有数据
    const data = await env.GUESTBOOK_KV.get('messages');
    const messages = data ? JSON.parse(data) : [];

    // 添加新留言
    messages.push(newMessage);

    // 限制最多100条（防止 KV 超限）
    if (messages.length > 100) {
      messages.sort((a, b) => a.timestamp - b.timestamp);
      messages.splice(0, messages.length - 100);
    }

    // 保存到 KV
    await env.GUESTBOOK_KV.put('messages', JSON.stringify(messages));

    // 发送邮件通知（可选，需要配置 RESEND_API_KEY）
    await sendNotification(env, newMessage);

    return jsonResponse({ 
      success: true, 
      message: newMessage 
    });

  } catch (error) {
    console.error('Post error:', error);
    return jsonResponse({ error: 'Failed to save message' }, 500);
  }
}

// 发送邮件通知（可选功能）
async function sendNotification(env, message) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) {
    return; // 未配置邮件，跳过
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@yourdomain.com',
        to: env.NOTIFY_EMAIL,
        subject: `新留言：${message.name}`,
        html: `
          <h2>有人给你留言了！</h2>
          <p><strong>来自：</strong>${message.name}</p>
          <p><strong>内容：</strong></p>
          <blockquote>${message.content}</blockquote>
          <p><strong>时间：</strong>${new Date(message.timestamp).toLocaleString('zh-CN')}</p>
        `,
      }),
    });
  } catch (error) {
    console.error('Email notification failed:', error);
    // 邮件失败不影响留言保存
  }
}

// 辅助函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function sanitize(text) {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getRandomAvatar() {
  const avatars = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦄', '🐲', '👽', '🤖', '👻', '🎃', '🌸', '🌺', '🌻', '🍀'];
  return avatars[Math.floor(Math.random() * avatars.length)];
}
