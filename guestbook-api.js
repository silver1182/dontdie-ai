// guestbook-api.js - 前端 API 调用模块
// 后端地址：Cloudflare Workers

const API_BASE_URL = 'https://dontdie-guestbook.2463317640.workers.dev';

// 获取留言列表
async function fetchMessages() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`);
    const data = await response.json();
    
    if (data.success) {
      renderGuestbookList(data.messages);
    } else {
      showToast('获取留言失败', 'error');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('网络错误，使用本地存储', 'error');
    renderGuestbookFromLocal();
  }
}

// 提交新留言
async function submitMessageToAPI(name, content) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, content }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('留言成功！感谢你的留言~ 🎉');
      fetchMessages();
      return true;
    } else {
      showToast('提交失败：' + (data.error || '未知错误'), 'error');
      return false;
    }
  } catch (error) {
    console.error('Submit error:', error);
    showToast('网络错误，请检查连接', 'error');
    return false;
  }
}

// 提交表单处理
async function submitGuestbookAPI() {
  const nameInput = document.getElementById('guest-name');
  const messageInput = document.getElementById('guest-message');
  
  const name = nameInput.value.trim();
  const content = messageInput.value.trim();
  
  if (!name) {
    showToast('请输入你的昵称~', 'error');
    nameInput.focus();
    return;
  }
  
  if (!content) {
    showToast('写点什么吧~', 'error');
    messageInput.focus();
    return;
  }
  
  if (content.length > 500) {
    showToast('留言太长了，控制在500字以内吧~', 'error');
    return;
  }
  
  const btn = document.querySelector('.guestbook-form button');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>发送中...</span>';
  btn.disabled = true;
  
  const success = await submitMessageToAPI(name, content);
  
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  if (success) {
    messageInput.value = '';
  }
}

// 渲染留言列表
function renderGuestbookList(messages) {
  const container = document.getElementById('guestbook-entries');
  if (!container) return;
  
  if (messages.length === 0) {
    container.innerHTML = `
      <div class="guestbook-empty">
        <span class="emoji">📝</span>
        <p>还没有留言，来做第一个留言的人吧~</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = messages.map(msg => `
    <div class="guestbook-entry">
      <div class="entry-header">
        <div class="entry-author">
          <span class="avatar">${msg.avatar || '👤'}</span>
          <span class="name">${escapeHtml(msg.name)}</span>
        </div>
        <span class="entry-time">${formatTime(msg.timestamp)}</span>
      </div>
      <div class="entry-content">${escapeHtml(msg.content)}</div>
    </div>
  `).join('');
}

// 降级到本地存储
function renderGuestbookFromLocal() {
  const messages = getGuestbookData();
  renderGuestbookList(messages);
}

// 初始化
function initGuestbookAPI() {
  fetchMessages();
  setInterval(fetchMessages, 30000); // 每30秒自动刷新
}

// 工具函数
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 导出
window.submitGuestbookAPI = submitGuestbookAPI;
window.initGuestbookAPI = initGuestbookAPI;