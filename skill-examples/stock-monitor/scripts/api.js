/**
 * 股票数据接口
 * 支持 Tushare / 东方财富 等数据源
 */

const axios = require('axios');

class StockAPI {
  constructor() {
    this.token = process.env.TUSHARE_TOKEN;
    this.baseURL = 'https://api.tushare.pro';
    
    // 缓存
    this.cache = new Map();
    this.cacheTime = 60000; // 1分钟缓存
  }

  // 获取股票行情
  async getQuote(code, market = 'a') {
    const cacheKey = `${market}_${code}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.time < this.cacheTime) {
      return cached.data;
    }

    try {
      // 使用 Tushare API
      const response = await axios.post(this.baseURL, {
        api_name: 'daily',
        token: this.token,
        params: {
          ts_code: this.formatCode(code, market),
          trade_date: this.getToday()
        },
        fields: 'ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg'
      });

      if (response.data && response.data.data && response.data.data.items) {
        const item = response.data.data.items[0];
        const fields = response.data.data.fields;
        
        const data = {
          code: item[fields.indexOf('ts_code')],
          date: item[fields.indexOf('trade_date')],
          open: parseFloat(item[fields.indexOf('open')]),
          high: parseFloat(item[fields.indexOf('high')]),
          low: parseFloat(item[fields.indexOf('low')]),
          price: parseFloat(item[fields.indexOf('close')]),
          previousClose: parseFloat(item[fields.indexOf('pre_close')]),
          change: parseFloat(item[fields.indexOf('change')]),
          changePercent: parseFloat(item[fields.indexOf('pct_chg')])
        };

        this.cache.set(cacheKey, { data, time: Date.now() });
        return data;
      }

      // 如果 Tushare 失败，使用备用数据源
      return await this.getQuoteBackup(code, market);
    } catch (error) {
      console.warn(`Tushare API 失败，使用备用数据源: ${error.message}`);
      return await this.getQuoteBackup(code, market);
    }
  }

  // 备用数据源：东方财富
  async getQuoteBackup(code, market) {
    try {
      let url;
      
      if (market === 'us') {
        // 美股
        url = `https://push2.eastmoney.com/api/qt/stock/get?secid=105.${code}`;
      } else if (market === 'hk') {
        // 港股
        url = `https://push2.eastmoney.com/api/qt/stock/get?secid=116.${code}`;
      } else {
        // A股
        const prefix = code.startsWith('6') ? '1' : '0';
        url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${prefix}.${code}`;
      }

      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.data) {
        const d = response.data.data;
        return {
          code: d.f12,
          name: d.f14,
          price: parseFloat(d.f43) / 100,
          open: parseFloat(d.f46) / 100,
          high: parseFloat(d.f44) / 100,
          low: parseFloat(d.f45) / 100,
          previousClose: parseFloat(d.f60) / 100,
          change: parseFloat(d.f169),
          changePercent: parseFloat(d.f170)
        };
      }
    } catch (error) {
      console.error(`备用数据源也失败了: ${error.message}`);
    }
    
    return null;
  }

  // 格式化股票代码
  formatCode(code, market) {
    if (market === 'us') return code;
    if (market === 'hk') return `${code}.HK`;
    
    // A股
    if (code.startsWith('6')) return `${code}.SH`;
    return `${code}.SZ`;
  }

  // 获取今日日期 (YYYYMMDD)
  getToday() {
    const d = new Date();
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  // 获取K线数据（用于技术分析）
  async getKLine(code, market = 'a', days = 60) {
    try {
      const response = await axios.post(this.baseURL, {
        api_name: 'daily',
        token: this.token,
        params: {
          ts_code: this.formatCode(code, market),
          start_date: this.getDateNDaysAgo(days),
          end_date: this.getToday()
        },
        fields: 'trade_date,open,high,low,close,vol'
      });

      if (response.data?.data?.items) {
        return response.data.data.items.map(item => ({
          date: item[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        })).reverse();
      }
    } catch (error) {
      console.error('获取K线数据失败:', error.message);
    }
    return [];
  }

  getDateNDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
}

module.exports = StockAPI;