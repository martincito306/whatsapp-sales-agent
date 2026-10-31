const axios = require('axios');
const salesEngine = require('../sales/salesEngine');
const whatsappService = require('../services/whatsappService');

class NotificationService {
  get adminPhone() {
    return process.env.ADMIN_PHONE;
  }

  get telegramToken() {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  get telegramChatId() {
    return process.env.TELEGRAM_CHAT_ID;
  }

  async notifyNewReceipt({ order, customer, receiptReference }) {
    const formattedTotal = salesEngine.formatCOP(order.total_price);
    const message = `🚨 *¡NUEVO COMPROBANTE RECIBIDO!* 🚨

👤 *Cliente:* ${customer.name || 'Cliente'}
📱 *WhatsApp:* +${customer.phone_number}
📦 *Pedido:* ${order.order_code}
💻 *Servicio:* ${order.product_name}
💰 *Total:* ${formattedTotal}
🟡 *Estado:* PENDIENTE DE VERIFICACIÓN
🔒 *Ref. Comprobante:* ${receiptReference}

👉 Ingresa al Panel Administrativo autenticado para visualizar el comprobante privado y aprobar o rechazar el pago.`;

    console.log('\n==================================================');
    console.log(message);
    console.log('==================================================\n');

    const results = { console: true };

    if (this.telegramToken && this.telegramChatId) {
      try {
        await axios.post(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'Markdown'
        });
        results.telegram = true;
      } catch (err) {
        console.warn('⚠️ No se pudo enviar alerta a Telegram:', err.message);
      }
    }

    if (this.adminPhone && process.env.WHATSAPP_TOKEN) {
      try {
        await whatsappService.sendTextMessage(this.adminPhone, message);
        results.whatsapp = true;
      } catch (err) {
        console.warn('⚠️ No se pudo enviar WhatsApp al Admin:', err.message);
      }
    }

    return results;
  }

  async notifyHumanHandoff({ customer, lastMessage }) {
    const message = `⚠️ *SOLICITUD DE ATENCIÓN HUMANA* 👨‍💻

👤 *Cliente:* ${customer.name || 'Cliente'}
📱 *WhatsApp:* +${customer.phone_number}
💬 *Último mensaje:* "${lastMessage}"

👉 El bot ha sido pausado para este chat.`;

    console.log('\n' + message + '\n');

    if (this.telegramToken && this.telegramChatId) {
      try {
        await axios.post(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
          chat_id: this.telegramChatId,
          text: message,
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.warn('⚠️ Fallo alerta Telegram handoff:', err.message);
      }
    }
  }
}

module.exports = new NotificationService();
