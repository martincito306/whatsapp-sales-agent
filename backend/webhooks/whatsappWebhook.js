const express = require('express');
const router = express.Router();
const agentController = require('../ai/agentController');
const whatsappService = require('../services/whatsappService');
const storageService = require('../services/storageService');
const { verifyWebhookSignature, safeCompare } = require('../middlewares/authMiddleware');

/**
 * 1. VERIFICACIÓN DEL WEBHOOK DE META (GET)
 * Sin tokens quemados en el código: exige WHATSAPP_VERIFY_TOKEN en .env
 */
router.get('/', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('❌ WHATSAPP_VERIFY_TOKEN no está definido en .env');
    return res.sendStatus(503);
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && safeCompare(String(token), verifyToken)) {
    console.log('✅ WEBHOOK_VERIFICADO_EXITOSAMENTE por Meta');
    return res.status(200).send(challenge);
  }

  console.warn('❌ Intento de verificación de Webhook con token inválido');
  return res.sendStatus(403);
});

/**
 * 2. RECEPCIÓN DE MENSAJES DE WHATSAPP (POST)
 * Protegido con validación criptográfica HMAC-SHA256 (X-Hub-Signature-256)
 */
router.post('/', verifyWebhookSignature, async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change || !change.messages || change.messages.length === 0) {
      return;
    }

    const message = change.messages[0];
    const contact = change.contacts?.[0];

    const phoneNumber = message.from;
    const customerName = contact?.profile?.name || null;
    const messageType = message.type;

    let messageText = '';
    let hasMedia = false;
    let receiptReference = null;

    if (messageType === 'text') {
      messageText = message.text?.body || '';
    } else if (messageType === 'image' || messageType === 'document') {
      hasMedia = true;
      const mediaObj = messageType === 'image' ? message.image : message.document;
      const mediaId = mediaObj?.id;
      messageText = mediaObj?.caption || '[Comprobante enviado]';

      if (mediaId) {
        const metaTempUrl = await whatsappService.getMediaUrl(mediaId);
        if (metaTempUrl) {
          const stored = await storageService.processWhatsAppMedia(metaTempUrl, process.env.WHATSAPP_TOKEN);
          if (stored?.reference) {
            receiptReference = stored.reference;
          }
        }
      }
    } else if (messageType === 'interactive') {
      messageText = message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title || '';
    }

    if (!messageText && !hasMedia) {
      return;
    }

    const result = await agentController.handleIncomingMessage({
      phoneNumber,
      customerName,
      messageText,
      hasMedia,
      receiptReference
    });

    if (result && result.reply) {
      await whatsappService.sendTextMessage(phoneNumber, result.reply);
    }
  } catch (error) {
    console.error('❌ Error procesando webhook de WhatsApp:', error.message);
  }
});

module.exports = router;
