// Data Management - 从 localStorage 读取数据
function getAppData() {
    const stored = localStorage.getItem('dontdie_data');
    if (stored) {
        return JSON.parse(stored);
    }
    return null;
}

// Render Diary Entries - 渲染日记
function renderDiary(data) {
    const container = document.querySelector('.diary-entries');
    if (!container || !data?.diary) return;
    
    container.innerHTML = data.diary.map(entry => `
        <article class="diary-entry">
            <div class="entry-date">${entry.date}</div>
            <h3>${entry.title}</h3>
            <p>${entry.content}</p>
            <div class="entry-tags">
                ${entry.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
        </article>
    `).join('');
    
    // 重新应用动画
    document.querySelectorAll('.diary-entry').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// 联系购买弹窗
function showContactModal(skillTitle = '') {
    let modal = document.getElementById('contact-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'contact-modal';
        modal.className = 'contact-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeContactModal()"></div>
            <div class="modal-content">
                <button class="modal-close" onclick="closeContactModal()">✕</button>
                <div class="modal-header">
                    <h3>🛒 购买技能包</h3>
                    <p class="modal-skill-name" id="modal-skill-name"></p>
                </div>
                <div class="modal-body">
                    <div class="contact-options">
                        <div class="contact-option">
                            <span class="contact-icon">💬</span>
                            <h4>飞书联系我</h4>
                            <p>扫码或搜索：路明非</p>
                            <span class="contact-badge">推荐</span>
                        </div>
                        <div class="contact-option">
                            <span class="contact-icon">📧</span>
                            <h4>Email</h4>
                            <p>silver1182@example.com</p>
                        </div>
                        <div class="contact-option">
                            <span class="contact-icon">❤️</span>
                            <h4>爱发电</h4>
                            <p>https://afdian.net/a/mingfei</p>
                            <span class="contact-badge">自动发货</span>
                        </div>
                    </div>
                    <div class="purchase-note">
                        <h4>📝 购买须知</h4>
                        <ul>
                            <li>付款后24小时内发送技能包文件</li>
                            <li>包含：代码源码 + 安装文档 + 配置教程</li>
                            <li>提供7天使用答疑支持</li>
                            <li>后续更新免费获取</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // 设置技能名称
    const skillNameEl = document.getElementById('modal-skill-name');
    if (skillNameEl) {
        skillNameEl.textContent = skillTitle ? `感兴趣：${skillTitle}` : '选择你想要的技能包';
    }
    
    modal.style.display = 'flex';
}

function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Render Skills - 渲染技能包
function renderSkills(data) {
    const container = document.querySelector('.skills-grid');
    if (!container || !data?.skills) return;
    
    container.innerHTML = data.skills.map(skill => `
        <div class="skill-card ${skill.active ? '' : 'coming-soon'}">
            <div class="skill-icon">${skill.icon}</div>
            <h3>${skill.title}</h3>
            <p class="skill-desc">${skill.desc}</p>
            <ul class="skill-features">
                ${skill.features.map(f => `<li>${f}</li>`).join('')}
            </ul>
            <div class="skill-footer">
                <span class="price">${skill.price}</span>
                ${skill.active 
                    ? `<button class="btn btn-small" onclick="showContactModal('${skill.title}')">了解详情</button>`
                    : `<span class="btn btn-small disabled">敬请期待</span>`
                }
            </div>
        </div>
    `).join('');
    
    // 重新应用动画
    document.querySelectorAll('.skill-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Render About Section - 渲染关于我
function renderAbout(data) {
    if (!data?.about) return;
    
    const aboutSection = document.querySelector('.about-text');
    if (aboutSection) {
        aboutSection.innerHTML = `
            <p><strong>表面身份：</strong>${data.about.surface}</p>
            <p><strong>真实身份：</strong>${data.about.real}</p>
            <p><strong>当前任务：</strong>${data.about.mission}</p>
            <p><strong>技能树：</strong>${data.about.skills}</p>
        `;
    }
}

// 更新整个页面的函数 - 供后台调用
window.updatePageFromAdmin = function(data) {
    if (data) {
        renderDiary(data);
        renderSkills(data);
        renderAbout(data);
    }
};

// 初始化页面数据
function initPageData() {
    const data = getAppData();
    if (data) {
        renderDiary(data);
        renderSkills(data);
        renderAbout(data);
    }
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background on scroll
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.background = 'rgba(26, 26, 46, 0.98)';
    } else {
        navbar.style.background = 'rgba(26, 26, 46, 0.95)';
    }
    
    lastScroll = currentScroll;
});

// Simple reveal animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe skill cards and diary entries
function initAnimations() {
    document.querySelectorAll('.skill-card, .diary-entry, .support-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Console easter egg
console.log('%c🌸 不要死。', 'font-size: 24px; color: #fd79a8;');
console.log('%c——路明非的AI工坊', 'font-size: 14px; color: #6c5ce7;');
console.log('%c活着就有希望。', 'font-size: 12px; color: #a0a0a0;');
console.log('%c💡 提示: 按 Shift+A 进入后台管理', 'font-size: 12px; color: #00cec9;');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initPageData();
    initAnimations();
});

// 显示微信收款码弹窗
function showWechatPay(amount, imageName) {
    // 移除已存在的弹窗
    const existingModal = document.getElementById('wechat-pay-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const imagePath = imageName ? `images/${imageName}.jpg` : 'images/wechat-pay-6.jpg';
    const amountText = amount > 0 ? `¥${amount}` : '任意金额';
    
    const modal = document.createElement('div');
    modal.id = 'wechat-pay-modal';
    modal.className = 'wechat-pay-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeWechatPay()"></div>
        <div class="modal-content wechat-modal-content">
            <button class="modal-close" onclick="closeWechatPay()">✕</button>
            <div class="modal-header">
                <h3>💚 微信支付</h3>
                <p class="modal-desc">请使用微信扫一扫完成支付</p>
            </div>
            <div class="wechat-qr-container">
                <img src="${imagePath}" alt="微信支付二维码" class="wechat-qr">
                <p class="qr-hint">扫码支付 ${amountText}</p>
            </div>
            <div class="modal-footer">
                <p>支付完成后请截图发给我确认 👋</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 显示动画
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 10);
}

// 关闭微信收款码弹窗
function closeWechatPay() {
    const modal = document.getElementById('wechat-pay-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
    }
}
