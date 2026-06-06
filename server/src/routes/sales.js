const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { from, to, payment_method, customer_id, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT s.*, c.name AS customer_name,
      GROUP_CONCAT(si.product_name || ' x' || si.quantity, ' | ') AS items_summary
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (from) { sql += ' AND s.date >= ?'; params.push(from); }
  if (to) { sql += ' AND s.date <= ?'; params.push(to); }
  if (payment_method) { sql += ' AND s.payment_method = ?'; params.push(payment_method); }
  if (customer_id) { sql += ' AND s.customer_id = ?'; params.push(customer_id); }

  sql += ` GROUP BY s.id ORDER BY s.date DESC, s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const sales = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total_sales,
      COUNT(*) AS count,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) AS card,
      COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) AS transfer,
      COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END), 0) AS credit
    FROM sales WHERE date = ?
  `).get(today);

  const expenses = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE date = ?'
  ).get(today);

  const transactions = db.prepare(`
    SELECT 'sale' AS type, s.id, s.total AS amount, s.payment_method, s.notes,
      s.created_at, c.name AS customer_name,
      GROUP_CONCAT(si.product_name || ' x' || si.quantity, ', ') AS items_summary
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.date = ?
    GROUP BY s.id
    UNION ALL
    SELECT 'expense' AS type, e.id, -e.amount AS amount, e.category AS payment_method,
      e.description AS notes, e.created_at, NULL AS customer_name, NULL AS items_summary
    FROM expenses e WHERE e.date = ?
    ORDER BY created_at DESC
  `).all(today, today);

  res.json({
    date: today,
    total_sales: sales.total_sales,
    total_expenses: expenses.total_expenses,
    balance: sales.total_sales - expenses.total_expenses,
    count: sales.count,
    by_method: { cash: sales.cash, card: sales.card, transfer: sales.transfer, credit: sales.credit },
    transactions
  });
});

router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, c.name AS customer_name
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json(sale);
});

router.post('/', (req, res) => {
  const { items, payment_method = 'cash', customer_id, notes = '', date } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un producto' });
  }

  const saleDate = date || new Date().toISOString().split('T')[0];
  const total = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);

  const createSale = db.transaction(() => {
    const r = db.prepare(
      'INSERT INTO sales (customer_id, total, payment_method, notes, date) VALUES (?, ?, ?, ?, ?)'
    ).run(customer_id || null, total, payment_method, notes.trim(), saleDate);

    const saleId = r.lastInsertRowid;
    const insertItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const updateStock = db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?');

    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.price);
      insertItem.run(saleId, item.product_id || null, item.product_name, qty, price, qty * price);

      if (item.product_id) {
        updateStock.run(qty, item.product_id, qty);
      }
    }

    return db.prepare(`
      SELECT s.*, c.name AS customer_name FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?
    `).get(saleId);
  });

  res.status(201).json(createSale());
});

router.delete('/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const deleteSale = db.transaction(() => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
    for (const item of items) {
      if (item.product_id) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
      }
    }
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  });

  deleteSale();
  res.json({ ok: true });
});

module.exports = router;
