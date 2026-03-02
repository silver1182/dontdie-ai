---
name: stock-monitor
description: 自动监控股票行情，实时提醒涨跌，支持止损预警和技术分析简报
homepage: https://github.com/silver1182/stock-monitor
metadata:
  clawdbot:
    emoji: 📈
    requires:
      bins: [node, npm]
      env: [TUSHARE_TOKEN]
    author: 路明非
    version: 1.0.0
---

# 📈 股票监控助手

一个自动化的股票监控工具，支持实时行情、止损预警、技术分析简报。

## ✨ 功能特点

- ⚡ 实时行情监控 - 获取最新股价数据
- 🚨 止损预警 - 费率跌破设置的止损价时自动提醒
- 📊 技术分析 - 自动生成MA、MACD等指标分析
- 📢 多种推送方式 - 支持飞书、邮件、Webhook
- ⏰ 定时报告 - 按设置时间自动发送盘后总结

## 🚀 快速开始

### 1. 安装

```bash
npm install
```

### 2. 配置

复制配置文件模板：

```bash
cp config/stocks.json.example config/stocks.json
```

编辑 `config/stocks.json`：

```json
{
  "stocks": [
    {
      "code": "600519",
      "name": "茅台",
      "cost": 1500.00,
      "stopLoss": 5,
      "stopGain": 20,
      "notify": true
    },
    {
      "code": "00700",
      "name": "腾讯",
      "market": "hk",
      "cost": 350.00,
      "stopLoss": 8,
      "notify": true
    }
  ],
  "settings": {
    "checkInterval": 300,
    "reportTime": ["09:30", "15:00"],
    "notifyChannels": ["feishu"]
  }
}
```

### 3. 设置环境变量

```bash
export TUSHARE_TOKEN="你的tushare token"
export FEISHU_WEBHOOK="你的飞书webhook地址"
```

### 4. 运行

```bash
# 前台运行
node scripts/monitor.js

# 后台运行
nohup node scripts/monitor.js > monitor.log 2>&1 &
```

## 📋 配置说明

### 股票配置项

| 字段 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| code | 股票代码 | string | 必填 |
| name | 股票名称 | string | 必填 |
| market | 市场(a/hk/us) | string | a |
| cost | 成本价 | number | 0 |
| shares | 持有股数 | number | 0 |
| stopLoss | 止损百分比(%) | number | 5 |
| stopGain | 止盈百分比(%) | number | 10 |
| notify | 是否通知 | boolean | true |

### 通知频率设置

```json
{
  "settings": {
    "checkInterval": 300,      // 检查间隔（秒）
    "alertCooldown": 1800,     // 同一股票预警冷却（秒）
    "marketHoursOnly": true,   // 仅交易时间提醒
    "reportTime": ["09:30", "15:00", "21:00"]  // 定时报告时间
  }
}
```

## 📱 通知方式

### 飞书通知

在飞书群组中添加自定义机器人，获取 webhook 地址，填入配置。

### 邮件通知

```json
{
  "settings": {
    "notifyChannels": ["email"],
    "email": {
      "smtp": "smtp.gmail.com",
      "port": 587,
      "user": "your@gmail.com",
      "pass": "app-password",
      "to": "recipient@example.com"
    }
  }
}
```

### Webhook

```json
{
  "settings": {
    "notifyChannels": ["webhook"],
    "webhook": {
      "url": "https://your-server.com/webhook",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

## 📉 止损策略

支持多种止损方式：

1. **固定比例**：设置跌幅百分比（如 5%）
2. **固定价格**：设置具体价格（如 1400元）
3. **移动止损**：根据最高价回调（如从最高点回调 10%）
4. **条件止损**：结合指标触发（如突破支撑位）

## 📊 报告样例

### 实时提醒
```
🚨 止损预警
茅台(600519) 盘中跌幅1.2%
当前: ¥1482.50
成本: ¥1500.00
盈亏: -¥17.50 (-1.17%)
止损位: ¥1425.00 (5%)
```

### 盘后报告
```
📈 今日收盘 (2026-03-02)

【茅台】润 +1.2%
当前: ¥1518.00 | 成本: ¥1500.00
盈亏: +¥18.00 (+1.2%)

【腾讯】跌 -2.5%
当前: HK$341.25 | 成本: HK$350.00
盈亏: -HK$8.75 (-2.5%)

总资产: ¥31,850.00
总盈亏: +¥120.00 (+0.38%)
```

## 🧪 高级功能

### 自定义指标

```javascript
// 在 config/indicators.js 中添加
module.exports = {
  customIndicators: [
    {
      name: 'MyMA',
      calculate: (prices, period) => {
        // 自定义计算逻辑
        return prices.slice(-period).reduce((a,b) => a+b) / period;
      }
    }
  ]
};
```

### 多市场支持

- **A股**：直接使用 6位代码（如 600519）
- **港股**：设置 `market: "hk"`，使用港股代码（如 00700）
- **美股**：设置 `market: "us"`，使用英文代码（如 TSLA）

## 📝 更新日志

### v1.0.0 (2026-03-02)
- ✅ 首次发布
- ✅ 支持实时监控和止损预警
- ✅ 支持飞书/邮件/Webhook通知
- ✅ 支持多市场(A股/港股/美股)

## 💡 常见问题

**Q: 需要付费吗？**
A: Tushare 免费版每日有流量限制，个人使用足够。如需更高频率，可升级付费版。

**Q: 股票代码怎么查？**
A: 腾讯财经、东方财富网都可以查询股票代码。

**Q: 支持多少只股票同时监控？**
A: 理论上无限制，但建议不要超过20只，以免请求过于频繁。

## 💾 License

MIT License - 自由使用和修改

---

Made with 🌸 by 路明非
