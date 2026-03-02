/**
 * 报告生成模块
 * 生成盘后总结报告
 */

const Alert = require('./alert');

class Report {
  constructor(settings) {
    this.settings = settings;
    this.alert = new Alert(settings);
  }

  // 生成盘后报告
  async generateDaily(stocks) {
    const report = this.buildReport(stocks);
    
    // 发送报告
    await this.alert.send({
      type: 'report',
      title: `📊 今日收盘报告 (${new Date().toLocaleDateString()})`,
      content: report
    });

    console.log('📊 盘后报告已发送');
  }

  // 构建报告内容
  buildReport(stocks) {
    let totalCost = 0;
    let totalValue = 0;
    let totalProfit = 0;

    const stockLines = stocks.map(s => {
      const cost = s.cost * s.shares;
      const value = s.currentPrice * s.shares;
      const profit = value - cost;
      const profitPercent = s.profitPercent;

      totalCost += cost;
      totalValue += value;
      totalProfit += profit;

      const emoji = profit >= 0 ? '📈' : '📉';
      const trend = profit >= 0 ? '涨' : '跌';

      return `${emoji} **${s.name}** ${trend} ${Math.abs(profitPercent)}%\n` +
             `   当前: ¥${s.currentPrice.toFixed(2)} | 成本: ¥${s.cost.toFixed(2)}\n` +
             `   盈亏: ${profit >= 0 ? '+' : ''}¥${profit.toFixed(2)} (${profitPercent}%)\n`;
    }).join('\n');

    const totalProfitPercent = totalCost > 0 
      ? (totalProfit / totalCost * 100).toFixed(2) 
      : 0;

    const summaryEmoji = totalProfit >= 0 ? '🟢' : '🔴';

    return `## 📊 今日收盘 (${new Date().toLocaleDateString()})\n\n` +
           `${stockLines}\n` +
           `---\n` +
           `**${summaryEmoji} 总资产**: ¥${totalValue.toFixed(2)}\n` +
           `**成本合计**: ¥${totalCost.toFixed(2)}\n` +
           `**总盈亏**: ${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toFixed(2)} (${totalProfitPercent}%)\n\n` +
           `_发送时间: ${new Date().toLocaleString()}_`;
  }

  // 生成技术分析报告
  async generateTechAnalysis(stock, klineData) {
    if (!klineData || klineData.length < 20) {
      console.warn(`${stock.name} K线数据不足，跳过技术分析`);
      return;
    }

    const analysis = {
      ma5: this.calculateMA(klineData, 5),
      ma10: this.calculateMA(klineData, 10),
      ma20: this.calculateMA(klineData, 20),
      rsi: this.calculateRSI(klineData, 14),
      trend: this.analyzeTrend(klineData)
    };

    const report = `## 📈 ${stock.name} 技术分析\n\n` +
                   `**趋势**: ${analysis.trend}\n` +
                   `**MA5**: ${analysis.ma5.toFixed(2)}\n` +
                   `**MA10**: ${analysis.ma10.toFixed(2)}\n` +
                   `**MA20**: ${analysis.ma20.toFixed(2)}\n` +
                   `**RSI(14)**: ${analysis.rsi.toFixed(2)}\n`;

    return report;
  }

  // 计算移动平均线
  calculateMA(data, period) {
    if (data.length < period) return 0;
    const closes = data.slice(-period).map(d => d.close);
    return closes.reduce((a, b) => a + b) / period;
  }

  // 计算RSI
  calculateRSI(data, period = 14) {
    if (data.length < period + 1) return 50;

    const closes = data.slice(-period - 1).map(d => d.close);
    let gains = 0, losses = 0;

    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // 分析趋势
  analyzeTrend(data) {
    const ma5 = this.calculateMA(data, 5);
    const ma20 = this.calculateMA(data, 20);
    const current = data[data.length - 1].close;

    if (current > ma5 && ma5 > ma20) return '强势上涨 📈📈';
    if (current > ma20) return '上涨 📈';
    if (current < ma5 && ma5 < ma20) return '强势下跌 📉📉';
    if (current < ma20) return '下跌 📉';
    return '震荡盘整 ➡️';
  }
}

module.exports = Report;