require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Capturar rawBody para validación criptográfica HMAC-SHA256 (X-Hub-Signature-256)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Rate Limiter contra spam y ataques DoS
const rateLimiter = require('./middlewares/rateLimiter');
app.use(rateLimiter.middleware());

// Conexión a base de datos PostgreSQL (Supabase)
require('./config/database');

// Rutas de la API administrativa (Protegidas por adminAuth fail-closed)
const apiRoutes = require('./routes/apiRoutes');
app.use('/api', apiRoutes);

// NOTA DE SEGURIDAD: La carpeta de comprobantes (/uploads) NO se expone con express.static.
// Los comprobantes solo se sirven a través de GET /api/orders/:id/receipt-image con autenticación.

// Servir el Frontend del Panel Administrativo (requiere ingresar ADMIN_KEY para consultar /api/*)
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// Webhook Oficial de WhatsApp Cloud API (Protegido por verifyWebhookSignature)
const whatsappWebhook = require('./webhooks/whatsappWebhook');
app.use('/webhook/whatsapp', whatsappWebhook);

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'whatsapp-sales-agent' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 WhatsApp AI Sales Agent corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
