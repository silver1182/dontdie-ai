// guestbook-api.js - 前端 API 调用模块
// 配合 Cloudflare Workers 后端使用

// ============================================
// 配置 - 部署后把这里改成你的 Workers 地址
// ============================================
const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev';
// const API_BASE_URL = 'http://localhost:8787'; // 本地测试用

// ============================================
// API 调用函数
// ============================================

// 获取留言列表
async function fetchMessages() {
  try {
    showLoading();
    const response = await fetch(`${API_BASE_URL}/api/messages`);
    const data = await response.json();
    
    if (data.success) {
      renderGuestbookList(data.messages);
    } else {
      showToast('获取留言失败：' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('网络错误，请稍后重试', 'error');
    // 降级到本地存储（可选）
    renderGuestbookFromLocal();
  } finally {
    hideLoading();
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
      // 刷新列表
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

// ============================================
// 渲染函数（兼容现有样式）
// ============================================

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

// 降级方案：从 localStorage 读取（可选）
function renderGuestbookFromLocal() {
  const messages = getGuestbookData(); // 复用原来的 localStorage 函数
  renderGuestbookList(messages);
}

// ============================================
// 表单处理
// ============================================

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
  
  // 显示加载状态
  const btn = document.querySelector('.guestbook-form button');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>发送中...</span>';
  btn.disabled = true;
  
  // 提交到 API
  const success = await submitMessageToAPI(name, content);
  
  // 恢复按钮
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  if (success) {
    // 清空留言内容（保留昵称）
    messageInput.value = '';
  }
}

// ============================================
// 工具函数（复用原来的）
// ============================================

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

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

function showLoading() {
  const container = document.getElementById('guestbook-entries');
  if (container) {
    container.innerHTML = '<div class="guestbook-loading">加载中...</div>';
  }
}

function hideLoading() {
  // 内容由 renderGuestbookList 填充
}

// ============================================
// 初始化
// ============================================

function initGuestbookAPI() {
  // 页面加载时获取留言
  fetchMessages();
  
  // 每30秒自动刷新（可选）
  setInterval(fetchMessages, 30000);
}

// 导出给 HTML 调用
window.submitGuestbookAPI = submitGuestbookAPI;
window.initGuestbookAPI = initGuestbookAPI;
