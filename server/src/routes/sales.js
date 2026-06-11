const express = require('express');
const { db, wrap } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', wrap(async (req, res) => {
  const { from, to, payment_method, customer_id, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT s.*, c.name AS customer_name,
      STRING_AGG(si.product_name || ' x' || si.quantity, ' | ') AS items_summary
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

  sql += ' GROUP BY s.id, c.name ORDER BY s.date DESC, s.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json(await db.all(sql, params));
}));

router.get('/today', wrap(async (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];

  const sales = await db.get(`
    SELECT COALESCE(SUM(total),0) AS total_sales,
      COUNT(*) AS count,
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) AS card,
      COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END),0) AS transfer,
      COALESCE(SUM(CASE WHEN payment_method='credit' THEN total ELSE 0 END),0) AS credit
    FROM sales WHERE date = ?
  `, [today]);

  const expenses = await db.get(
    'SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses WHERE date = ?',
    [today]
  );

  const transactions = await db.all(`
    SELECT 'sale' AS type, s.id, s.total AS amount, s.payment_method, s.notes,
      s.created_at, c.name AS customer_name,
      STRING_AGG(si.product_name || ' x' || si.quantity, ', ') AS items_summary
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.date = ?
    GROUP BY s.id, s.total, s.payment_method, s.notes, s.created_at, c.name
    UNION ALL
    SELECT 'expense' AS type, e.id, -e.amount AS amount, e.category AS payment_method,
      e.description AS notes, e.created_at, NULL AS customer_name, NULL AS items_summary
    FROM expenses e WHERE e.date = ?
    ORDER BY created_at DESC
  `, [today, today]);

  res.json({
    date: today,
    total_sales: Number(sales.total_sales),
    total_expenses: Number(expenses.total_expenses),
    balance: Number(sales.total_sales) - Number(expenses.total_expenses),
    count: Number(sales.count),
    by_method: { cash: Number(sales.cash), card: Number(sales.card), transfer: Number(sales.transfer), credit: Number(sales.credit) },
    transactions,
  });
}));

router.get('/:id', wrap(async (req, res) => {
  const sale = await db.get(`
    SELECT s.*, c.name AS customer_name
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `, [req.params.id]);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  sale.items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
  res.json(sale);
}));

router.post('/', wrap(async (req, res) => {
  const { items, payment_method = 'cash', customer_id, notes = '', date } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un producto' });
  }

  const saleDate = date || new Date().toISOString().split('T')[0];
  const total = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);

  const sale = await db.transaction(async (tx) => {
    const created = await tx.get(
      'INSERT INTO sales (customer_id, total, payment_method, notes, date) VALUES (?,?,?,?,?) RETURNING *',
      [customer_id || null, total, payment_method, notes.trim(), saleDate]
    );

    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.price);
      await tx.run(
        'INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal) VALUES (?,?,?,?,?,?)',
        [created.id, item.product_id || null, item.product_name, qty, price, qty * price]
      );
      if (item.product_id) {
        await tx.run(
          'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?',
          [qty, item.product_id, qty]
        );
      }
    }

    return tx.get(
      'SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?',
      [created.id]
    );
  });

  res.status(201).json(sale);
}));

router.delete('/:id', wrap(async (req, res) => {
  const sale = await db.get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  await db.transaction(async (tx) => {
    const items = await tx.all('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
    for (const item of items) {
      if (item.product_id) {
        await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }
    await tx.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
  });

  res.json({ ok: true });
}));

module.exports = router;
