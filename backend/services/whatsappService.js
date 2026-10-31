const axios = require('axios');

/**
 * SERVICIO DE MENSAJERÍA OFICIAL DE WHATSAPP (META CLOUD API)
 */
class WhatsAppService {
  constructor() {
    this.apiVersion = 'v20.0';
  }

  get token() {
    return process.env.WHATSAPP_TOKEN;
  }

  get phoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendTextMessage(to, text) {
    if (!this.token || !this.phoneNumberId) {
      console.log(`\n📱 [SIMULACIÓN WHATSAPP - MODO LOCAL]`);
      console.log(`➡️ Para: ${to}`);
      console.log(`💬 Mensaje enviado:\n${text}\n`);
      return { success: true, simulated: true };
    }

    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { preview_url: false, body: text }
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Error enviando mensaje por WhatsApp Cloud API:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getMediaUrl(mediaId) {
    if (!this.token) {
      return null;
    }

    try {
      const metaRes = await axios.get(
        `https://graph.facebook.com/${this.apiVersion}/${mediaId}`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
      return metaRes.data.url;
    } catch (error) {
      console.error('❌ Error obteniendo URL de multimedia de Meta:', error.message);
      return null;
    }
  }
}

module.exports = new WhatsAppService();
