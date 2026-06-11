const express = require('express');
const { db, wrap } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const CATEGORIES = [
  'Alquiler', 'Servicios', 'Proveedores', 'Sueldos', 'Transporte',
  'Marketing', 'Impuestos', 'Mantenimiento', 'Otros'
];

router.get('/categories', (_, res) => res.json(CATEGORIES));

router.get('/', wrap(async (req, res) => {
  const { from, to, category, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  if (category) { sql += ' AND category = ?'; params.push(category); }

  sql += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  res.json(await db.all(sql, params));
}));

router.post('/', wrap(async (req, res) => {
  const { category, amount, description = '', date } = req.body;
  if (!category || !amount) return res.status(400).json({ error: 'Categoría y monto requeridos' });

  const row = await db.get(
    'INSERT INTO expenses (category, amount, description, date) VALUES (?,?,?,?) RETURNING *',
    [category, Number(amount), description.trim(), date || new Date().toISOString().split('T')[0]]
  );
  res.status(201).json(row);
}));

router.put('/:id', wrap(async (req, res) => {
  const existing = await db.get('SELECT id FROM expenses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

  const { category, amount, description, date } = req.body;
  const row = await db.get(`
    UPDATE expenses SET
      category = COALESCE(?, category),
      amount = COALESCE(?, amount),
      description = COALESCE(?, description),
      date = COALESCE(?, date)
    WHERE id = ? RETURNING *`,
    [category || null, amount != null ? Number(amount) : null, description != null ? String(description).trim() : null, date || null, req.params.id]
  );
  res.json(row);
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
