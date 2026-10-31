const db = require('../config/database');

class CustomerService {
  async getOrCreateCustomer(phoneNumber, name = null) {
    const findQuery = `SELECT * FROM customers WHERE phone_number = $1`;
    const findRes = await db.query(findQuery, [phoneNumber]);

    if (findRes.rows.length > 0) {
      await db.query(`UPDATE customers SET last_interaction = CURRENT_TIMESTAMP WHERE id = $1`, [findRes.rows[0].id]);
      return findRes.rows[0];
    }

    const insertQuery = `
      INSERT INTO customers (phone_number, name, state, bot_active)
      VALUES ($1, $2, 'NEW', true)
      RETURNING *
    `;
    const insertRes = await db.query(insertQuery, [phoneNumber, name]);
    return insertRes.rows[0];
  }

  async updateCustomerState(customerId, newState) {
    const query = `
      UPDATE customers
      SET state = $1, last_interaction = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const res = await db.query(query, [newState, customerId]);
    return res.rows[0];
  }

  async updateCustomerName(customerId, name) {
    const query = `
      UPDATE customers
      SET name = $1
      WHERE id = $2
      RETURNING *
    `;
    const res = await db.query(query, [name, customerId]);
    return res.rows[0];
  }

  async setBotActive(customerId, isActive) {
    const query = `
      UPDATE customers
      SET bot_active = $1, state = CASE WHEN $1 = false THEN 'HUMAN_HANDOFF' ELSE state END
      WHERE id = $2
      RETURNING *
    `;
    const res = await db.query(query, [isActive, customerId]);
    return res.rows[0];
  }
}

module.exports = new CustomerService();
