# 股票监控助手 v1.0.0

## 📦 交付清单

你购买的技能包包含以下文件：

```
stock-monitor/
├── SKILL.md              # 完整技能文档
├── README.md             # 本文件
├── package.json          # 依赖配置
├── config/
│   ├── stocks.json.example    # 股票配置模板
│   └── settings.json.example  # 高级设置模板
├── scripts/
│   ├── monitor.js        # 主监控程序
│   ├── api.js            # 数据接口
│   ├── alert.js          # 通知模块
│   └── report.js         # 报告生成
└── templates/
    └── alert-templates.js # 消息模板
```

## 🚀 5分钟快速上手

### 步骤1：安装依赖（1分钟）

```bash
cd stock-monitor
npm install
```

### 步骤2：配置股票（2分钟）

```bash
# 复制配置文件
cp config/stocks.json.example config/stocks.json

# 编辑配置
nano config/stocks.json  # 或者用你喜欢的编辑器
```

填入你的股票信息：

```json
{
  "stocks": [
    {
      "code": "600519",
      "name": "茅台",
      "cost": 1500.00,
      "stopLoss": 5,
      "notify": true
    }
  ]
}
```

### 步骤3：设置Token（1分钟）

1. 访问 https://tushare.pro 注册账号
2. 获取你的 Token
3. 设置环境变量：

```bash
export TUSHARE_TOKEN="你的token"
```

### 步骤4：运行（1分钟）

```bash
node scripts/monitor.js
```

看到输出 `🚀 股票监控已启动` 就成功了！

## 📱 设置飞书通知

1. 打开飞书群 → 设置 → 群机器人 → 添加机器人
2. 选择「自定义机器人」
3. 复制 Webhook 地址
4. 设置环境变量：

```bash
export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
```

## 🔧 常用命令

```bash
# 前台运行（查看日志）
node scripts/monitor.js

# 后台运行
nohup node scripts/monitor.js > monitor.log 2>&1 &
echo $! > monitor.pid  # 保存进程ID

# 停止监控
kill $(cat monitor.pid)

# 查看日志
tail -f monitor.log
```

## ⚙️ 配置详解

见 `SKILL.md` 的「配置说明」章节。

## 🆘 获取帮助

遇到问题？

1. 先看 SKILL.md 的「常见问题」
2. 检查日志文件 `monitor.log`
3. 联系开发者获取支持

## 📞 联系方式

- 飞书：路明非
- Email：silver1182@example.com
- 爱发电：https://afdian.net/a/mingfei

---

感谢购买！祝投资顺利 📈
