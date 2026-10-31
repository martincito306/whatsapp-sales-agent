const express = require('express');
const router = express.Router();
const db = require('../config/database');
const catalogService = require('../services/catalogService');
const orderService = require('../services/orderService');
const customerService = require('../services/customerService');
const storageService = require('../services/storageService');
const { adminAuth } = require('../middlewares/authMiddleware');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================================================
// PROTECCIÓN GLOBAL: TODAS LAS RUTAS DE /api/* REQUIEREN AUTENTICACIÓN ADMIN
// ============================================================================
router.use(adminAuth);

// 1. PRODUCTOS & COMBOS
router.get('/products', async (req, res) => {
  try {
    const products = await catalogService.getProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, category, price, duration_days, duration_text, description } = req.body;
    const query = `
      INSERT INTO products (name, category, price, duration_days, duration_text, description, is_available)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `;
    const result = await db.query(query, [name, category, price, duration_days || 30, duration_text || '30 días', description]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, is_available, duration_text } = req.body;
    const query = `
      UPDATE products
      SET name = COALESCE($1, name),
          price = COALESCE($2, price),
          is_available = COALESCE($3, is_available),
          duration_text = COALESCE($4, duration_text),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;
    const result = await db.query(query, [name, price, is_available, duration_text, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/combos', async (req, res) => {
  try {
    const combos = await catalogService.getCombos();
    res.json({ success: true, data: combos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/combos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, is_available } = req.body;
    const query = `
      UPDATE combos
      SET name = COALESCE($1, name),
          price = COALESCE($2, price),
          is_available = COALESCE($3, is_available)
      WHERE id = $4
      RETURNING *
    `;
    const result = await db.query(query, [name, price, is_available, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. PEDIDOS (ORDERS) Y ACCESO PRIVADO A COMPROBANTES
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, c.name as customer_name, c.phone_number
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
    `;
    const params = [];
    if (status) {
      query += ` WHERE o.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY o.created_at DESC`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, delivery_notes } = req.body;
    const updated = await orderService.updateOrderStatus(id, status, delivery_notes);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint privado para obtener la imagen o Signed URL de un comprobante (Solo Admin autenticado)
router.get('/orders/:id/receipt-image', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order || !order.receipt_url) {
      return res.status(404).json({ success: false, error: 'Comprobante no encontrado' });
    }

    const resolved = await storageService.getSignedUrlOrLocalPath(order.receipt_url);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Archivo de comprobante no disponible' });
    }

    if (resolved.type === 'redirect') {
      return res.redirect(resolved.url);
    }
    return res.sendFile(resolved.path);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orders/:id/receipt', upload.single('receipt'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo de comprobante' });
    }
    const uploadResult = await storageService.uploadReceipt(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    const updatedOrder = await orderService.attachReceipt(id, uploadResult.reference);

    const customerRes = await db.query('SELECT * FROM customers WHERE id = $1', [updatedOrder.customer_id]);
    const customer = customerRes.rows[0] || { name: 'Cliente', phone_number: 'N/A' };

    const notificationService = require('../notifications/notificationService');
    await notificationService.notifyNewReceipt({
      order: updatedOrder,
      customer,
      receiptReference: uploadResult.reference
    });

    res.json({ success: true, data: updatedOrder, upload: uploadResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. CLIENTES & CONFIGURACIÓN
router.get('/customers', async (req, res) => {
  try {
    const query = `SELECT * FROM customers ORDER BY last_interaction DESC`;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/customers/:id/bot', async (req, res) => {
  try {
    const { id } = req.params;
    const { bot_active } = req.body;
    const updated = await customerService.setBotActive(id, bot_active);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const query = `SELECT key, value FROM system_settings`;
    const result = await db.query(query);
    const settings = {};
    result.rows.forEach(r => settings[r.key] = r.value);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
