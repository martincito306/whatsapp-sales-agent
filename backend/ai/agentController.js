const db = require('../config/database');
const customerService = require('../services/customerService');
const orderService = require('../services/orderService');
const salesEngine = require('../sales/salesEngine');
const geminiAgent = require('./geminiAgent');
const notificationService = require('../notifications/notificationService');

/**
 * CONTROLADOR ORQUESTADOR DEL AGENTE DE VENTAS
 * Garantiza que los precios de órdenes y los estados de pago sean controlados
 * exclusivamente por el motor determinístico y la base de datos.
 */
class AgentController {
  async handleIncomingMessage({ phoneNumber, customerName = null, messageText, hasMedia = false, receiptReference = null }) {
    const customer = await customerService.getOrCreateCustomer(phoneNumber, customerName);

    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'bot_active'");
    const isGlobalBotActive = settingsRes.rows[0]?.value === true || settingsRes.rows[0]?.value === 'true';

    if (!isGlobalBotActive || !customer.bot_active) {
      console.log(`⏸️ Bot pausado para el cliente ${phoneNumber} (Atención Humana / Hand-off)`);
      return null;
    }

    await db.query(
      `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'user', $2)`,
      [customer.id, messageText || '[Comprobante adjunto]']
    );

    // 1. Solicitud explícita de humano
    if (this.isAskingForHuman(messageText)) {
      const reply = await salesEngine.handoffToHuman(customer.id);
      await notificationService.notifyHumanHandoff({ customer, lastMessage: messageText });
      await db.query(
        `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'assistant', $2)`,
        [customer.id, reply]
      );
      return { reply, action: 'HUMAN_HANDOFF' };
    }

    // 2. DETECCIÓN DE COMPROBANTE (La IA nunca procesa ni confirma pagos)
    if (hasMedia || this.isClaimingPayment(messageText)) {
      const pendingOrder = await orderService.getLatestPendingOrder(customer.id);
      if (pendingOrder) {
        const refToSave = receiptReference || 'pendiente_archivo_adjunto';
        await orderService.attachReceipt(pendingOrder.id, refToSave);
        await customerService.updateCustomerState(customer.id, 'RECEIPT_RECEIVED');

        await notificationService.notifyNewReceipt({
          order: pendingOrder,
          customer,
          receiptReference: refToSave
        });

        const reply = salesEngine.getReceiptReceivedMessage(pendingOrder.order_code);
        await db.query(
          `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'assistant', $2)`,
          [customer.id, reply]
        );

        return {
          reply,
          action: 'RECEIPT_PROCESSED',
          order: pendingOrder
        };
      } else {
        const noOrderReply = `No encontramos una orden pendiente de pago asociada a tu número. Primero indícame qué servicio o combo deseas adquirir para generarte un código de pedido.`;
        await db.query(
          `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'assistant', $2)`,
          [customer.id, noOrderReply]
        );
        return { reply: noOrderReply, action: 'NO_PENDING_ORDER' };
      }
    }

    // 3. DETECCIÓN DETERMINÍSTICA DE COMPRA (Combos y Productos Individuales desde la BD)
    const checkoutDetection = await this.detectQuickCheckout(messageText);
    if (checkoutDetection) {
      const checkoutResult = await salesEngine.createCheckout(
        customer,
        checkoutDetection.type,
        checkoutDetection.item
      );

      await db.query(
        `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'assistant', $2)`,
        [customer.id, checkoutResult.message]
      );

      return {
        reply: checkoutResult.message,
        action: 'ORDER_CREATED',
        order: checkoutResult.order
      };
    }

    // 4. Conversación asistida por IA con catálogo inyectado desde la BD
    const historyRes = await db.query(
      `SELECT role, message FROM conversations WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [customer.id]
    );
    const history = historyRes.rows.reverse();

    const botReply = await geminiAgent.generateResponse(customer, messageText, history);

    await db.query(
      `INSERT INTO conversations (customer_id, role, message) VALUES ($1, 'assistant', $2)`,
      [customer.id, botReply]
    );

    return {
      reply: botReply,
      action: 'CHAT'
    };
  }

  isAskingForHuman(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('hablar con una persona') ||
           lower.includes('hablar con humano') ||
           lower.includes('asesor humano') ||
           lower.includes('administrador');
  }

  isClaimingPayment(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('ya pague') ||
           lower.includes('ya pagué') ||
           lower.includes('comprobante') ||
           lower.includes('te envio el pago') ||
           lower.includes('te paso el pago') ||
           lower.includes('mande el pantallazo');
  }

  async detectQuickCheckout(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    // A) Buscar mención de "combo X"
    const comboMatch = lower.match(/combo\s*#?\s*(\d+)/i);
    if (comboMatch) {
      const comboNum = parseInt(comboMatch[1], 10);
      const res = await db.query('SELECT * FROM combos WHERE combo_number = $1 AND is_available = true', [comboNum]);
      if (res.rows.length > 0) {
        return { type: 'combo', item: res.rows[0] };
      }
    }

    // B) Buscar intención de compra de producto individual ("quiero comprar X", "ordenar X", "adquirir X")
    const hasBuyIntent = /(quiero comprar|comprar|ordenar|adquirir|dame el|quiero el)/i.test(lower);
    if (hasBuyIntent) {
      const prodRes = await db.query('SELECT * FROM products WHERE is_available = true');
      for (const prod of prodRes.rows) {
        const prodKeywords = prod.name.toLowerCase().split('(')[0].trim();
        if (prodKeywords.length > 3 && lower.includes(prodKeywords)) {
          return { type: 'product', item: prod };
        }
      }
    }

    return null;
  }
}

module.exports = new AgentController();
