const db = require('../config/database');

class CatalogService {
  async getProducts() {
    const query = `
      SELECT id, name, category, price, duration_days, duration_text, is_available, description
      FROM products
      ORDER BY category ASC, price ASC
    `;
    const res = await db.query(query);
    return res.rows;
  }

  async getCombos() {
    const query = `
      SELECT id, combo_number, name, price, duration_text, is_available, description
      FROM combos
      ORDER BY combo_number ASC
    `;
    const res = await db.query(query);
    return res.rows;
  }

  async searchCatalog(term) {
    const searchTerm = `%${term.toLowerCase().trim()}%`;

    const prodQuery = `
      SELECT id, name, category, price, duration_text, is_available, description, 'product' as type
      FROM products
      WHERE LOWER(name) LIKE $1 OR LOWER(category) LIKE $1
    `;
    const prodRes = await db.query(prodQuery, [searchTerm]);

    const comboQuery = `
      SELECT id, combo_number, name, price, duration_text, is_available, description, 'combo' as type
      FROM combos
      WHERE LOWER(name) LIKE $1 OR CAST(combo_number AS TEXT) LIKE $1
    `;
    const comboRes = await db.query(comboQuery, [searchTerm]);

    return {
      products: prodRes.rows,
      combos: comboRes.rows
    };
  }

  async getByBudget(maxBudget) {
    const prodQuery = `
      SELECT id, name, category, price, duration_text, is_available, 'product' as type
      FROM products
      WHERE price <= $1 AND is_available = true
      ORDER BY price DESC
      LIMIT 5
    `;
    const comboQuery = `
      SELECT id, combo_number, name, price, duration_text, is_available, 'combo' as type
      FROM combos
      WHERE price <= $1 AND is_available = true
      ORDER BY price DESC
      LIMIT 5
    `;

    const [prodRes, comboRes] = await Promise.all([
      db.query(prodQuery, [maxBudget]),
      db.query(comboQuery, [maxBudget])
    ]);

    return {
      products: prodRes.rows,
      combos: comboRes.rows
    };
  }

  async getPaymentMethods() {
    const query = `SELECT value FROM system_settings WHERE key = 'payment_methods'`;
    const res = await db.query(query);
    return res.rows[0]?.value || {};
  }

  async getBusinessInfo() {
    const query = `SELECT value FROM system_settings WHERE key = 'business_info'`;
    const res = await db.query(query);
    return res.rows[0]?.value || { name: 'NovaCloud Digital', currency: 'COP' };
  }
}

module.exports = new CatalogService();
