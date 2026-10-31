const crypto = require('crypto');

/**
 * MIDDLEWARE DE SEGURIDAD EMPRESARIAL (FAIL-CLOSED + HMAC-SHA256)
 */

/**
 * Comparación en tiempo constante para prevenir ataques de timing (Timing Attacks)
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Autenticación obligatoria para rutas administrativas (/api/*)
 * Diseño Fail-Closed: Si ADMIN_KEY no está configurada en .env, bloquea el acceso.
 */
function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.trim().length < 8) {
    return res.status(503).json({
      success: false,
      error: 'Configuración de seguridad incompleta: ADMIN_KEY (mínimo 8 caracteres) es obligatoria en .env'
    });
  }

  const providedKey = req.headers['x-admin-key'];
  if (providedKey && safeCompare(providedKey, adminKey)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'No autorizado. Se requiere cabecera x-admin-key válida.'
  });
}

/**
 * Validación criptográfica de firma X-Hub-Signature-256 de Meta (WhatsApp Cloud API)
 */
function verifyWebhookSignature(req, res, next) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('❌ WHATSAPP_APP_SECRET no configurado. Rechazando webhook por seguridad (Fail-Closed).');
    return res.status(401).json({ success: false, error: 'Webhook signature secret not configured' });
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader || !req.rawBody) {
    return res.status(401).json({ success: false, error: 'Missing X-Hub-Signature-256 header' });
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  if (!safeCompare(signatureHeader, expectedSignature)) {
    console.warn('⚠️ Firma X-Hub-Signature-256 inválida detectada y bloqueada.');
    return res.status(401).json({ success: false, error: 'Invalid X-Hub-Signature-256 signature' });
  }

  next();
}

/**
 * Enmascara credenciales sensibles para evitar fugas en logs
 */
function maskSensitive(text) {
  if (!text) return '';
  return text.replace(/(password|token|key|secret|clave|contraseña)[:=]\s*([^\s&]+)/gi, '$1=********');
}

module.exports = {
  adminAuth,
  verifyWebhookSignature,
  maskSensitive,
  safeCompare
};
