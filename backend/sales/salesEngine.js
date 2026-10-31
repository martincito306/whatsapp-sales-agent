const catalogService = require('../services/catalogService');
const customerService = require('../services/customerService');
const orderService = require('../services/orderService');

/**
 * MOTOR DE VENTAS DETERMINÍSTICO (CONTROL DE ESTADOS, CARRITO Y CHECKOUT)
 */
class SalesEngine {
  formatCOP(amount) {
    const num = Math.round(Number(amount));
    return `$${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  getWelcomeMessage(customerName = null, businessName = 'NovaCloud Digital') {
    const greeting = customerName ? `¡Hola de nuevo, ${customerName}! 👋` : `¡Hola! 👋 Bienvenido a ${businessName} 🚀`;
    return `${greeting}

Asistente de ventas y soporte disponible 24/7.

¿Qué estás buscando hoy?
1️⃣ Ver servicios y licencias individuales
2️⃣ Ver paquetes / combos con descuento
3️⃣ Consultar catálogo completo
4️⃣ Recomendación según mi presupuesto
5️⃣ Adquirir un servicio
6️⃣ Hablar con un asesor humano

*(También puedes escribir directamente lo que buscas, ej: "Cuánto vale el VPS" o "Quiero el combo 1")*`;
  }

  async getProductsListMessage() {
    const products = await catalogService.getProducts();
    let msg = `💻 *CATÁLOGO DE SERVICIOS Y LICENCIAS* 🚀\n\n`;

    products.forEach(p => {
      const statusTag = p.is_available ? '' : ' *(Agotado)*';
      msg += `• *${p.name}* (${p.duration_text}) → ${this.formatCOP(p.price)}${statusTag}\n`;
    });

    msg += `\nPara ordenar alguno, escribe por ejemplo: *"Quiero comprar ${products[0]?.name || 'un servicio'}"*.`;
    return msg;
  }

  async getCombosListMessage() {
    const combos = await catalogService.getCombos();
    let msg = `🔥 *PAQUETES Y COMBOS EMPRESARIALES* 📦\n\n`;

    combos.forEach(c => {
      const statusTag = c.is_available ? '' : ' *(Agotado)*';
      msg += `*Combo #${c.combo_number}:* ${c.name}${statusTag}\n💰 Precio: ${this.formatCOP(c.price)} (${c.duration_text})\n\n`;
    });

    msg += `Para ordenar uno, escribe por ejemplo: *"Quiero el combo 1"* y genero tu orden al instante.`;
    return msg;
  }

  async getBudgetRecommendation(budget) {
    const { products, combos } = await catalogService.getByBudget(budget);

    if (products.length === 0 && combos.length === 0) {
      return `Con un presupuesto de ${this.formatCOP(budget)} no encontramos planes disponibles en este momento. ¿Te gustaría ver nuestras opciones iniciales?`;
    }

    let msg = `¡De una! 🔥 Con tu presupuesto de *${this.formatCOP(budget)}*, estas son las mejores opciones disponibles:\n\n`;

    if (combos.length > 0) {
      msg += `*Paquetes recomendados:*\n`;
      combos.slice(0, 3).forEach(c => {
        msg += `• *Combo #${c.combo_number}* (${c.name}) → ${this.formatCOP(c.price)}\n`;
      });
      msg += `\n`;
    }

    if (products.length > 0) {
      msg += `*Servicios individuales:*\n`;
      products.slice(0, 3).forEach(p => {
        msg += `• *${p.name}* (${p.duration_text}) → ${this.formatCOP(p.price)}\n`;
      });
    }

    msg += `\n¿Cuál de estas opciones deseas ordenar?`;
    return msg;
  }

  async createCheckout(customer, itemType, itemData) {
    const paymentMethods = await catalogService.getPaymentMethods();
    const nequiInfo = paymentMethods.nequi || { account: 'Pendiente de configurar', name: 'Administrador' };

    const order = await orderService.createOrder({
      customerId: customer.id,
      productName: itemData.name,
      comboNumber: itemType === 'combo' ? itemData.combo_number : null,
      totalPrice: itemData.price,
      paymentMethod: 'Nequi / Transferencia'
    });

    await customerService.updateCustomerState(customer.id, 'WAITING_PAYMENT');

    return {
      order,
      message: `¡Perfecto! 🔥 Tu orden ha sido generada con éxito:

📋 *DETALLES DEL PEDIDO:*
• Código: *${order.order_code}*
• Servicio: *${order.product_name}*
• Total a pagar: *${this.formatCOP(order.total_price)}*

💳 *DATOS DE PAGO:*
• Cuenta Nequi / Transferencia: *${nequiInfo.account}*
• Titular: *${nequiInfo.name}*

📲 *PASO SIGUIENTE:*
Realiza la transferencia por el valor exacto y envía la imagen o captura del comprobante por este chat. Nuestro equipo verificará la transacción manualmente antes de liberar tus credenciales.`
    };
  }

  getReceiptReceivedMessage(orderCode) {
    return `¡Recibido! 👍 Hemos registrado tu comprobante para el pedido *${orderCode}*.

Estado actual: *🟡 Pendiente de verificación por el administrador*.

Importante: La recepción del comprobante no equivale a la aprobación automática del pago. En breve validaremos la transacción y te enviaremos tus accesos.`;
  }

  async handoffToHuman(customerId) {
    await customerService.setBotActive(customerId, false);
    return `Entendido. 👨‍💻 He transferido tu conversación a un asesor humano y he pausado mis respuestas automáticas. En breve te atenderemos personalmente.`;
  }
}

module.exports = new SalesEngine();
