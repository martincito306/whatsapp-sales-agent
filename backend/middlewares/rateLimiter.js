/**
 * MIDDLEWARE DE RATE LIMITING EN MEMORIA (COSTO $0, SIN DEPENDENCIAS EXTERNAS)
 * Protege contra spam, ataques de denegación de servicio (DoS) y saturación de webhooks.
 */
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const now = Date.now();

      if (!this.requests.has(ip)) {
        this.requests.set(ip, []);
      }

      const timestamps = this.requests.get(ip).filter(time => now - time < this.windowMs);

      if (timestamps.length >= this.maxRequests) {
        console.warn(`⚠️ Rate limit superado para la IP: ${ip}`);
        return res.status(429).json({
          success: false,
          error: 'Demasiadas solicitudes. Por favor espera un momento.'
        });
      }

      timestamps.push(now);
      this.requests.set(ip, timestamps);
      next();
    };
  }
}

module.exports = new RateLimiter();
