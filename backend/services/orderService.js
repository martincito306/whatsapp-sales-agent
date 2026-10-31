const db = require('../config/database');

class OrderService {
  async generateOrderCode() {
    const res = await db.query('SELECT count(*) FROM orders');
    const nextNumber = parseInt(res.rows[0].count, 10) + 1;
    return `ORDER-${String(nextNumber).padStart(4, '0')}`;
  }

  async createOrder({ customerId, productName, comboNumber = null, totalPrice, paymentMethod = 'Transferencia' }) {
    const orderCode = await this.generateOrderCode();
    const query = `
      INSERT INTO orders (order_code, customer_id, product_name, combo_number, total_price, payment_method, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE_PAGO')
      RETURNING *
    `;
    const res = await db.query(query, [
      orderCode,
      customerId,
      productName,
      comboNumber,
      totalPrice,
      paymentMethod
    ]);
    return res.rows[0];
  }

  async getOrderById(orderId) {
    const res = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return res.rows[0] || null;
  }

  async getLatestPendingOrder(customerId) {
    const query = `
      SELECT * FROM orders
      WHERE customer_id = $1 AND status IN ('PENDIENTE_PAGO', 'COMPROBANTE_RECIBIDO', 'PAGO_VERIFICACION')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const res = await db.query(query, [customerId]);
    return res.rows[0] || null;
  }

  async attachReceipt(orderId, receiptReference) {
    const query = `
      UPDATE orders
      SET receipt_url = $1, status = 'COMPROBANTE_RECIBIDO', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const res = await db.query(query, [receiptReference, orderId]);
    return res.rows[0];
  }

  async updateOrderStatus(orderId, status, deliveryNotes = null) {
    let query, params;
    if (deliveryNotes !== null && deliveryNotes !== undefined) {
      query = `
        UPDATE orders
        SET status = $1, delivery_notes = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      params = [status, deliveryNotes, orderId];
    } else {
      query = `
        UPDATE orders
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      params = [status, orderId];
    }
    const res = await db.query(query, params);
    return res.rows[0];
  }

  async getCustomerOrderHistory(customerId) {
    const query = `
      SELECT * FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `;
    const res = await db.query(query, [customerId]);
    return res.rows;
  }
}

module.exports = new OrderService();
