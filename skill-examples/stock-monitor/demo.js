#!/usr/bin/env node
/**
 * 茅台股票监控演示
 * 使用东方财富API获取实时数据（无需Token）
 */

const axios = require('axios');

// 茅台配置
const CONFIG = {
  code: '600519',
  name: '贵州茅台',
  market: 'a',
  cost: 1500.00,      // 假设成本价
  shares: 100,        // 假设持有100股
  stopLoss: 5,        // 5%止损
  stopGain: 15,       // 15%止盈
  notify: true
};

console.log('='.repeat(60));
console.log('🚀 股票监控助手 - 茅台(600519) 演示');
console.log('='.repeat(60));
console.log();
console.log('📊 配置信息:');
console.log(`   股票: ${CONFIG.name} (${CONFIG.code})`);
console.log(`   成本: ¥${CONFIG.cost}`);
console.log(`   持有: ${CONFIG.shares} 股`);
console.log(`   止损线: -${CONFIG.stopLoss}%`);
console.log(`   止盈线: +${CONFIG.stopGain}%`);
console.log();

// 获取茅台实时行情
async function getMoutaiQuote() {
  console.log('⏳ 正在获取实时行情...\n');
  
  try {
    // 东方财富API - A股前缀1表示上海
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=1.${CONFIG.code}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data?.data) {
      const d = response.data.data;
      
      // 解析数据
      const data = {
        name: d.f14,
        code: d.f12,
        price: parseFloat(d.f43) / 100,
        open: parseFloat(d.f46) / 100,
        high: parseFloat(d.f44) / 100,
        low: parseFloat(d.f45) / 100,
        previousClose: parseFloat(d.f60) / 100,
        change: parseFloat(d.f169),
        changePercent: parseFloat(d.f170),
        volume: parseFloat(d.f47) / 10000, // 万手
        amount: parseFloat(d.f48) / 100000000, // 亿元
        updateTime: new Date().toLocaleString()
      };
      
      return data;
    }
    
    throw new Error('无法获取数据');
  } catch (error) {
    console.error('❌ 获取数据失败:', error.message);
    return null;
  }
}

// 计算盈亏和预警
function analyzePosition(data) {
  const { price, previousClose, changePercent } = data;
  const { cost, shares, stopLoss, stopGain } = CONFIG;
  
  // 计算盈亏
  const marketValue = price * shares;
  const costBasis = cost * shares;
  const profit = marketValue - costBasis;
  const profitPercent = ((price - cost) / cost * 100).toFixed(2);
  
  // 判断是否触发预警
  const alerts = [];
  
  if (parseFloat(profitPercent) <= -stopLoss) {
    alerts.push({
      type: 'stopLoss',
      emoji: '🚨',
      title: '止损预警',
      message: `跌幅已达到 ${Math.abs(profitPercent)}%，超过止损线 ${stopLoss}%`
    });
  }
  
  if (parseFloat(profitPercent) >= stopGain) {
    alerts.push({
      type: 'stopGain',
      emoji: '🎯',
      title: '止盈提醒',
      message: `涨幅已达到 ${profitPercent}%，超过止盈线 ${stopGain}%`
    });
  }
  
  return {
    marketValue,
    costBasis,
    profit,
    profitPercent,
    alerts
  };
}

// 显示行情面板
function displayQuote(data, analysis) {
  const { name, code, price, open, high, low, previousClose, changePercent, volume, amount, updateTime } = data;
  const { marketValue, costBasis, profit, profitPercent, alerts } = analysis;
  
  const trendEmoji = changePercent >= 0 ? '📈' : '📉';
  const profitEmoji = profit >= 0 ? '🟢' : '🔴';
  const changeColor = changePercent >= 0 ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  
  console.log('━'.repeat(60));
  console.log(`📊 ${trendEmoji} ${name} (${code}) 实时行情`);
  console.log('━'.repeat(60));
  console.log();
  console.log('💰 价格信息:');
  console.log(`   当前价格: ${changeColor}¥${price.toFixed(2)}${resetColor}`);
  console.log(`   今日涨跌: ${changeColor}${changePercent >= 0 ? '+' : ''}${changePercent}%${resetColor}`);
  console.log(`   今日开盘: ¥${open.toFixed(2)}`);
  console.log(`   今日最高: ¥${high.toFixed(2)}`);
  console.log(`   今日最低: ¥${low.toFixed(2)}`);
  console.log(`   昨收价格: ¥${previousClose.toFixed(2)}`);
  console.log();
  console.log('📈 成交数据:');
  console.log(`   成交量: ${volume.toFixed(2)} 万手`);
  console.log(`   成交额: ${amount.toFixed(2)} 亿元`);
  console.log();
  console.log('💼 持仓分析:');
  console.log(`   成本价: ¥${CONFIG.cost}`);
  console.log(`   持股数: ${CONFIG.shares} 股`);
  console.log(`   市值: ¥${marketValue.toFixed(2)}`);
  console.log(`   成本: ¥${costBasis.toFixed(2)}`);
  console.log(`   盈亏: ${profitEmoji} ${profit >= 0 ? '+' : ''}¥${profit.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent}%)`);
  console.log();
  
  // 预警区域
  if (alerts.length > 0) {
    console.log('⚠️  预警提醒:');
    alerts.forEach(alert => {
      console.log(`   ${alert.emoji} ${alert.title}`);
      console.log(`      ${alert.message}`);
    });
  } else {
    console.log('✅ 状态: 正常监控中，未触发预警');
  }
  
  console.log();
  console.log('━'.repeat(60));
  console.log(`⏰ 数据更新时间: ${updateTime}`);
  console.log('━'.repeat(60));
}

// 生成飞书消息模板
function generateFeishuMessage(data, analysis) {
  const { name, code, price, changePercent } = data;
  const { profit, profitPercent } = analysis;
  
  const trend = changePercent >= 0 ? '上涨' : '下跌';
  const profitStr = profit >= 0 ? `+¥${profit.toFixed(2)}` : `-¥${Math.abs(profit).toFixed(2)}`;
  
  return {
    title: `📈 ${name} 行情更新`,
    content: `**${name}(${code})** ${trend} ${Math.abs(changePercent)}%\n` +
             `当前: ¥${price.toFixed(2)}\n` +
             `持仓盈亏: ${profitStr} (${profitPercent >= 0 ? '+' : ''}${profitPercent}%)`
  };
}

// 技术分析（简单版）
function technicalAnalysis(data) {
  const { price, open, high, low, previousClose } = data;
  
  // 计算一些简单指标
  const dayRange = ((high - low) / low * 100).toFixed(2);
  const positionInRange = ((price - low) / (high - low) * 100).toFixed(1);
  
  console.log('📊 简单技术分析:');
  console.log(`   今日振幅: ${dayRange}%`);
  console.log(`   当前位置: ${positionInRange}% (0%=最低价, 100%=最高价)`);
  
  if (parseFloat(positionInRange) > 80) {
    console.log(`   💡 提示: 股价接近今日高点，注意回调风险`);
  } else if (parseFloat(positionInRange) < 20) {
    console.log(`   💡 提示: 股价接近今日低点，可能存在支撑`);
  }
  console.log();
}

// 主程序
async function main() {
  // 获取数据
  const data = await getMoutaiQuote();
  if (!data) {
    console.error('无法获取茅台数据，演示结束');
    process.exit(1);
  }
  
  // 分析持仓
  const analysis = analyzePosition(data);
  
  // 显示行情
  displayQuote(data, analysis);
  
  // 技术分析
  technicalAnalysis(data);
  
  // 显示飞书消息模板
  const feishuMsg = generateFeishuMessage(data, analysis);
  console.log('📱 飞书通知模板:');
  console.log('   标题:', feishuMsg.title);
  console.log('   内容:', feishuMsg.content.replace(/\n/g, ' | '));
  console.log();
  
  // 模拟预警效果
  console.log('🔄 模拟预警检查:');
  console.log(`   止损线: -${CONFIG.stopLoss}% (当前: ${analysis.profitPercent}%)`);
  console.log(`   止盈线: +${CONFIG.stopGain}% (当前: ${analysis.profitPercent}%)`);
  
  if (analysis.alerts.length === 0) {
    console.log('   ✅ 未触发任何预警');
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('✅ 演示完成！');
  console.log('='.repeat(60));
  console.log();
  console.log('💡 实际使用中:');
  console.log('   • 每5分钟自动检查一次');
  console.log('   • 触发预警时自动发送飞书/邮件通知');
  console.log('   • 收盘后自动生成盈亏报告');
  console.log('   • 支持多只股票同时监控');
}

// 运行
main().catch(console.error);
