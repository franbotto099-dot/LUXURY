const express = require('express');
const { db, wrap } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', wrap(async (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT c.*,
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) AS total_debt
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
  `;
  const params = [];
  if (search) {
    sql += ' WHERE (c.name ILIKE ? OR c.phone ILIKE ? OR c.email ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY c.id ORDER BY c.name ASC';
  res.json(await db.all(sql, params));
}));

router.get('/with-debt', wrap(async (req, res) => {
  const rows = await db.all(`
    SELECT c.*,
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) AS total_debt
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
    GROUP BY c.id
    HAVING
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) > 0
    ORDER BY total_debt DESC
  `);
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const c = await db.get(`
    SELECT cu.*,
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = cu.id), 0) AS total_debt
    FROM customers cu
    LEFT JOIN sales s ON s.customer_id = cu.id
    WHERE cu.id = ?
    GROUP BY cu.id
  `, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
}));

router.get('/:id/sales', wrap(async (req, res) => {
  const sales = await db.all(`
    SELECT s.*, STRING_AGG(si.product_name || ' x' || si.quantity, ', ') AS items_summary
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.customer_id = ?
    GROUP BY s.id
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT 50
  `, [req.params.id]);
  res.json(sales);
}));

router.get('/:id/debts', wrap(async (req, res) => {
  const debts = await db.all(`
    SELECT s.id AS sale_id, s.date, s.total,
      COALESCE(SUM(dp.amount), 0) AS paid,
      s.total - COALESCE(SUM(dp.amount), 0) AS remaining,
      s.notes
    FROM sales s
    LEFT JOIN debt_payments dp ON dp.sale_id = s.id
    WHERE s.customer_id = ? AND s.payment_method = 'credit'
    GROUP BY s.id
    HAVING s.total - COALESCE(SUM(dp.amount), 0) > 0
    ORDER BY s.date ASC
  `, [req.params.id]);
  res.json(debts);
}));

router.get('/:id/payments', wrap(async (req, res) => {
  res.json(await db.all('SELECT * FROM debt_payments WHERE customer_id = ? ORDER BY date DESC', [req.params.id]));
}));

router.post('/', wrap(async (req, res) => {
  const { name, phone = '', email = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const row = await db.get(
    'INSERT INTO customers (name, phone, email, notes) VALUES (?,?,?,?) RETURNING *',
    [name.trim(), phone.trim(), email.trim(), notes.trim()]
  );
  res.status(201).json(row);
}));

router.put('/:id', wrap(async (req, res) => {
  const existing = await db.get('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { name, phone, email, notes } = req.body;
  const row = await db.get(`
    UPDATE customers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      notes = COALESCE(?, notes)
    WHERE id = ? RETURNING *`,
    [name != null ? String(name).trim() : null, phone != null ? String(phone).trim() : null, email != null ? String(email).trim() : null, notes != null ? String(notes).trim() : null, req.params.id]
  );
  res.json(row);
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/:id/payments', wrap(async (req, res) => {
  const { sale_id, amount, date, notes = '' } = req.body;
  if (!sale_id || !amount) return res.status(400).json({ error: 'sale_id y amount requeridos' });

  const sale = await db.get('SELECT * FROM sales WHERE id = ? AND customer_id = ?', [sale_id, req.params.id]);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const row = await db.get(
    'INSERT INTO debt_payments (sale_id, customer_id, amount, date, notes) VALUES (?,?,?,?,?) RETURNING *',
    [sale_id, req.params.id, Number(amount), date || new Date().toISOString().split('T')[0], notes]
  );
  res.status(201).json(row);
}));

module.exports = router;
