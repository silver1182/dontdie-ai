/**
 * 通知模块
 * 支持飞书、邮件、Webhook
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

class Alert {
  constructor(settings) {
    this.settings = settings;
    this.channels = settings.notifyChannels || ['console'];
  }

  // 发送通知
  async send(data) {
    const messages = [];

    for (const channel of this.channels) {
      try {
        switch (channel) {
          case 'feishu':
            messages.push(this.sendFeishu(data));
            break;
          case 'email':
            messages.push(this.sendEmail(data));
            break;
          case 'webhook':
            messages.push(this.sendWebhook(data));
            break;
          case 'console':
          default:
            this.sendConsole(data);
        }
      } catch (error) {
        console.error(`发送 ${channel} 通知失败:`, error.message);
      }
    }

    await Promise.all(messages);
  }

  // 飞书通知
  async sendFeishu(data) {
    const webhook = process.env.FEISHU_WEBHOOK || this.settings.feishu?.webhook;
    if (!webhook) {
      console.warn('未配置飞书 Webhook');
      return;
    }

    const message = this.formatMessage(data);
    
    try {
      await axios.post(webhook, {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            title: {
              tag: 'plain_text',
              content: message.title
            },
            template: message.type === 'stopLoss' ? 'red' : 'green'
          },
          elements: [
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content: message.content
              }
            }
          ]
        }
      });
      console.log(`✅ 飞书通知已发送: ${data.stock}`);
    } catch (error) {
      console.error('飞书通知失败:', error.message);
    }
  }

  // 邮件通知
  async sendEmail(data) {
    const emailConfig = this.settings.email;
    if (!emailConfig?.user) {
      console.warn('未配置邮箱');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    });

    const message = this.formatMessage(data);

    try {
      await transporter.sendMail({
        from: `"股票监控" <${emailConfig.user}>`,
        to: emailConfig.to,
        subject: message.title,
        html: `<h2>${message.title}</h2>
               <pre>${message.content}</pre>
               <hr>
               <p>发送时间: ${new Date().toLocaleString()}</p>`
      });
      console.log(`✅ 邮件已发送: ${data.stock}`);
    } catch (error) {
      console.error('邮件发送失败:', error.message);
    }
  }

  // Webhook 通知
  async sendWebhook(data) {
    const webhook = this.settings.webhook;
    if (!webhook?.url) {
      console.warn('未配置 Webhook');
      return;
    }

    try {
      await axios.post(webhook.url, data, {
        headers: webhook.headers || {}
      });
      console.log(`✅ Webhook 已发送: ${data.stock}`);
    } catch (error) {
      console.error('Webhook 发送失败:', error.message);
    }
  }

  // 控制台通知
  sendConsole(data) {
    const message = this.formatMessage(data);
    console.log('\n' + '='.repeat(40));
    console.log(message.title);
    console.log('='.repeat(40));
    console.log(message.content);
    console.log('='.repeat(40) + '\n');
  }

  // 格式化消息
  formatMessage(data) {
    const { type, stock, code, currentPrice, cost, profitPercent } = data;
    
    switch (type) {
      case 'stopLoss':
        return {
          type: 'stopLoss',
          title: `🚨 止损预警 - ${stock}`,
          content: `**${stock}(${code})**\n` +
                   `当前: ¥${currentPrice.toFixed(2)}\n` +
                   `成本: ¥${cost.toFixed(2)}\n` +
                   `盈亏: ${profitPercent}%\n` +
                   `止损位: ${data.stopLossPercent}%`
        };

      case 'stopGain':
        return {
          type: 'stopGain',
          title: `🎯 止盈提醒 - ${stock}`,
          content: `**${stock}(${code})**\n` +
                   `当前: ¥${currentPrice.toFixed(2)}\n` +
                   `成本: ¥${cost.toFixed(2)}\n` +
                   `盈利: +${profitPercent}%\n` +
                   `止盈位: ${data.stopGainPercent}%`
        };

      default:
        return {
          type: 'info',
          title: `📈 ${stock}`,
          content: JSON.stringify(data, null, 2)
        };
    }
  }
}

module.exports = Alert;