#!/usr/bin/env node
/**
 * 股票监控主程序
 * 实时监控股票行情，发送预警和报告
 */

const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

// 加载配置
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'stocks.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// 加载模块
const StockAPI = require('./api');
const Alert = require('./alert');
const Report = require('./report');

class StockMonitor {
  constructor() {
    this.api = new StockAPI();
    this.alert = new Alert(config.settings);
    this.report = new Report(config.settings);
    this.lastAlertTime = {}; // 预警冷却记录
    
    console.log('🚀 股票监控助手启动中...');
    console.log(`📊 监控股票: ${config.stocks.length} 只`);
    console.log(`⏱️ 检查间隔: ${config.settings.checkInterval} 秒`);
  }

  // 检查单只股票
  async checkStock(stock) {
    try {
      // 获取实时行情
      const data = await this.api.getQuote(stock.code, stock.market);
      if (!data) return;

      const currentPrice = data.price;
      const previousClose = data.previousClose;
      const changePercent = ((currentPrice - previousClose) / previousClose * 100).toFixed(2);
      
      // 计算持仓盈亏
      const cost = stock.cost || 0;
      const shares = stock.shares || 0;
      const profit = (currentPrice - cost) * shares;
      const profitPercent = cost > 0 ? ((currentPrice - cost) / cost * 100).toFixed(2) : 0;

      // 检查止损
      await this.checkStopLoss(stock, currentPrice, cost, profitPercent);

      // 检查止盈
      await this.checkStopGain(stock, currentPrice, cost, profitPercent);

      return {
        ...stock,
        currentPrice,
        changePercent,
        profit,
        profitPercent,
        data
      };
    } catch (error) {
      console.error(`❌ 检查 ${stock.name} 失败:`, error.message);
      return null;
    }
  }

  // 检查止损
  async checkStopLoss(stock, currentPrice, cost, profitPercent) {
    if (!stock.notify || cost <= 0) return;
    
    const stopLossPercent = stock.stopLoss || 5;
    const cooldown = config.settings.alertCooldown || 1800;
    const alertKey = `${stock.code}_loss`;
    
    // 检查是否跌破止损线
    if (profitPercent <= -stopLossPercent) {
      // 检查冷却时间
      const lastAlert = this.lastAlertTime[alertKey];
      if (lastAlert && Date.now() - lastAlert < cooldown * 1000) {
        return;
      }
      
      this.lastAlertTime[alertKey] = Date.now();
      
      await this.alert.send({
        type: 'stopLoss',
        stock: stock.name,
        code: stock.code,
        currentPrice,
        cost,
        profitPercent,
        stopLossPercent
      });
    }
  }

  // 检查止盈
  async checkStopGain(stock, currentPrice, cost, profitPercent) {
    if (!stock.notify || cost <= 0) return;
    
    const stopGainPercent = stock.stopGain || 10;
    const cooldown = config.settings.alertCooldown || 1800;
    const alertKey = `${stock.code}_gain`;
    
    if (profitPercent >= stopGainPercent) {
      const lastAlert = this.lastAlertTime[alertKey];
      if (lastAlert && Date.now() - lastAlert < cooldown * 1000) {
        return;
      }
      
      this.lastAlertTime[alertKey] = Date.now();
      
      await this.alert.send({
        type: 'stopGain',
        stock: stock.name,
        code: stock.code,
        currentPrice,
        cost,
        profitPercent,
        stopGainPercent
      });
    }
  }

  // 运行检查
  async runCheck() {
    // 检查是否在交易时间（可选）
    if (config.settings.marketHoursOnly && !this.isMarketOpen()) {
      return;
    }

    console.log(`\n[${new Date().toLocaleString()}] 开始检查...`);
    
    const results = [];
    for (const stock of config.stocks) {
      const result = await this.checkStock(stock);
      if (result) results.push(result);
    }

    console.log(`✅ 检查完成，${results.length} 只股票正常`);
    return results;
  }

  // 判断是否在交易时间
  isMarketOpen() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 100 + minute;

    // 周末不交易
    if (day === 0 || day === 6) return false;

    // A股交易时间: 9:30-11:30, 13:00-15:00
    const isAM = time >= 930 && time <= 1130;
    const isPM = time >= 1300 && time <= 1500;

    return isAM || isPM;
  }

  // 生成盘后报告
  async generateReport() {
    console.log('\n📊 生成盘后报告...');
    const results = await this.runCheck();
    if (results.length > 0) {
      await this.report.generateDaily(results);
    }
  }

  // 启动监控
  start() {
    const interval = config.settings.checkInterval || 300;
    
    // 定时检查
    setInterval(() => {
      this.runCheck();
    }, interval * 1000);

    // 定时报告
    if (config.settings.reportTime) {
      config.settings.reportTime.forEach(time => {
        const [hour, minute] = time.split(':');
        schedule.scheduleJob(`${minute} ${hour} * * *`, () => {
          this.generateReport();
        });
      });
    }

    // 立即执行一次
    this.runCheck();

    console.log('\n✅ 监控已启动！');
    console.log('📱 按 Ctrl+C 停止\n');
  }
}

// 启动
const monitor = new StockMonitor();
monitor.start();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 正在停止监控...');
  process.exit(0);
});
