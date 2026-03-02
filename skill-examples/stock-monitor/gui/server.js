#!/usr/bin/env node
/**
 * 股票监控助手 - GUI 服务器
 * 启动后自动打开浏览器，提供图形界面
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3456;
const CONFIG_FILE = path.join(__dirname, '..', 'config', 'stocks.json');

// MIME 类型
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 确保配置文件存在
function ensureConfig() {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
            stocks: [],
            settings: {
                checkInterval: 300,
                alertCooldown: 1800,
                marketHoursOnly: true,
                notifyChannels: ["console"]
            }
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    }
}

// 读取配置
function getConfig() {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { stocks: [], settings: {} };
    }
}

// 保存配置
function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 静态文件服务
function serveStatic(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}

// HTTP 服务器
const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = req.url;
    
    // API 路由
    if (url === '/api/config' && req.method === 'GET') {
        const config = getConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(config));
        return;
    }
    
    if (url === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const config = getConfig();
                config.stocks = data.stocks || config.stocks;
                saveConfig(config);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    if (url === '/api/webhook' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const config = getConfig();
                if (!config.settings) config.settings = {};
                config.settings.notifyChannels = ['feishu'];
                config.settings.feishu = { webhook: data.webhook };
                saveConfig(config);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    if (url.startsWith('/api/quotes')) {
        // 获取实时行情数据
        const config = getConfig();
        const stocks = config.stocks || [];
        
        if (stocks.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ quotes: [] }));
            return;
        }
        
        // 异步获取行情
        const axios = require('axios');
        const quotes = [];
        
        const fetchQuotes = async () => {
            for (const stock of stocks) {
                try {
                    const prefix = stock.code.startsWith('6') ? '1' : '0';
                    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${prefix}.${stock.code}`;
                    const response = await axios.get(url, { timeout: 5000 });
                    
                    if (response.data && response.data.data) {
                        const d = response.data.data;
                        quotes.push({
                            code: stock.code,
                            name: d.f14,
                            price: parseFloat(d.f43) / 100,
                            changePercent: parseFloat(d.f170)
                        });
                    }
                } catch (e) {
                    // 单个股票失败不影响其他
                }
            }
            return quotes;
        };
        
        fetchQuotes().then(quotes => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ quotes }));
        }).catch(err => {
            console.error('获取行情失败:', err.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ quotes: [] }));
        });
        return;
    }
    
    // 静态文件
    let filePath;
    if (url === '/') {
        filePath = path.join(__dirname, 'index.html');
    } else {
        filePath = path.join(__dirname, url);
    }
    
    serveStatic(filePath, res);
});

// 打开浏览器
function openBrowser(url) {
    const platform = process.platform;
    let cmd;
    
    switch (platform) {
        case 'darwin':
            cmd = `open "${url}"`;
            break;
        case 'win32':
            cmd = `start "" "${url}"`;
            break;
        default:
            cmd = `xdg-open "${url}"`;
    }
    
    exec(cmd, (err) => {
        if (err) {
            console.log(`请手动打开浏览器访问: ${url}`);
        }
    });
}

// 启动
ensureConfig();

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('='.repeat(60));
    console.log('🚀 股票监控助手 GUI 已启动');
    console.log('='.repeat(60));
    console.log();
    console.log(`📱 请打开浏览器访问: ${url}`);
    console.log();
    console.log('正在自动打开浏览器...');
    console.log('如果浏览器没有自动打开，请手动复制上面的链接');
    console.log();
    console.log('按 Ctrl+C 停止服务');
    console.log('='.repeat(60));
    
    setTimeout(() => {
        openBrowser(url);
    }, 1000);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n👋 正在关闭服务...');
    server.close(() => {
        process.exit(0);
    });
});
