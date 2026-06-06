const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
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
    sql += ' WHERE (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY c.id ORDER BY c.name ASC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/with-debt', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) AS total_debt
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
    GROUP BY c.id
    HAVING total_debt > 0
    ORDER BY total_debt DESC
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const c = db.prepare(`
    SELECT cu.*,
      COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0)
        - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = cu.id), 0) AS total_debt
    FROM customers cu
    LEFT JOIN sales s ON s.customer_id = cu.id
    WHERE cu.id = ?
    GROUP BY cu.id
  `).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
});

router.get('/:id/sales', (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.quantity, ', ') AS items_summary
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.customer_id = ?
    GROUP BY s.id
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(sales);
});

router.get('/:id/debts', (req, res) => {
  const debts = db.prepare(`
    SELECT s.id as sale_id, s.date, s.total,
      COALESCE(SUM(dp.amount), 0) AS paid,
      s.total - COALESCE(SUM(dp.amount), 0) AS remaining,
      s.notes
    FROM sales s
    LEFT JOIN debt_payments dp ON dp.sale_id = s.id
    WHERE s.customer_id = ? AND s.payment_method = 'credit'
    GROUP BY s.id
    HAVING remaining > 0
    ORDER BY s.date ASC
  `).all(req.params.id);
  res.json(debts);
});

router.get('/:id/payments', (req, res) => {
  res.json(db.prepare('SELECT * FROM debt_payments WHERE customer_id = ? ORDER BY date DESC').all(req.params.id));
});

router.post('/', (req, res) => {
  const { name, phone = '', email = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const r = db.prepare('INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)').run(
    name.trim(), phone.trim(), email.trim(), notes.trim()
  );
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const c = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  const { name, phone, email, notes } = req.body;
  db.prepare(`UPDATE customers SET
    name = COALESCE(?, name),
    phone = COALESCE(?, phone),
    email = COALESCE(?, email),
    notes = COALESCE(?, notes)
    WHERE id = ?`
  ).run(
    name != null ? String(name).trim() : null,
    phone != null ? String(phone).trim() : null,
    email != null ? String(email).trim() : null,
    notes != null ? String(notes).trim() : null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Registrar pago de deuda
router.post('/:id/payments', (req, res) => {
  const { sale_id, amount, date, notes = '' } = req.body;
  if (!sale_id || !amount) return res.status(400).json({ error: 'sale_id y amount requeridos' });

  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND customer_id = ?').get(sale_id, req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const r = db.prepare(
    'INSERT INTO debt_payments (sale_id, customer_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(sale_id, req.params.id, Number(amount), date || new Date().toISOString().split('T')[0], notes);

  res.status(201).json(db.prepare('SELECT * FROM debt_payments WHERE id = ?').get(r.lastInsertRowid));
});

module.exports = router;
