const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { search, category, low_stock, active = 1 } = req.query;
  let sql = 'SELECT * FROM products WHERE active = ?';
  const params = [Number(active)];

  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (low_stock === 'true') {
    sql += ' AND stock <= min_stock';
  }
  sql += ' ORDER BY name ASC';

  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products WHERE category != "" AND active = 1 ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

router.get('/low-stock', (req, res) => {
  res.json(db.prepare('SELECT * FROM products WHERE stock <= min_stock AND active = 1 ORDER BY stock ASC').all());
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
});

router.post('/', (req, res) => {
  const { name, category = '', sale_price, cost_price = 0, stock = 0, min_stock = 5, description = '', image_url = '' } = req.body;
  if (!name || sale_price == null) return res.status(400).json({ error: 'Nombre y precio de venta requeridos' });

  const r = db.prepare(
    'INSERT INTO products (name, category, sale_price, cost_price, stock, min_stock, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), category.trim(), Number(sale_price), Number(cost_price), Number(stock), Number(min_stock), description.trim(), image_url);

  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, category, sale_price, cost_price, stock, min_stock, description, image_url } = req.body;
  db.prepare(`UPDATE products SET
    name = COALESCE(?, name),
    category = COALESCE(?, category),
    sale_price = COALESCE(?, sale_price),
    cost_price = COALESCE(?, cost_price),
    stock = COALESCE(?, stock),
    min_stock = COALESCE(?, min_stock),
    description = COALESCE(?, description),
    image_url = COALESCE(?, image_url),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(
    name != null ? String(name).trim() : null,
    category != null ? String(category).trim() : null,
    sale_price != null ? Number(sale_price) : null,
    cost_price != null ? Number(cost_price) : null,
    stock != null ? Number(stock) : null,
    min_stock != null ? Number(min_stock) : null,
    description != null ? String(description).trim() : null,
    image_url != null ? image_url : null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Importar desde CSV (array de productos)
router.post('/import', (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de productos' });
  }

  const insert = db.prepare(
    'INSERT INTO products (name, category, sale_price, cost_price, stock, min_stock, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const importMany = db.transaction((items) => {
    let created = 0, errors = [];
    for (const [i, item] of items.entries()) {
      if (!item.name || item.sale_price == null) {
        errors.push(`Fila ${i + 1}: nombre y precio de venta requeridos`);
        continue;
      }
      insert.run(
        String(item.name).trim(),
        String(item.category || '').trim(),
        Number(item.sale_price) || 0,
        Number(item.cost_price) || 0,
        Number(item.stock) || 0,
        Number(item.min_stock) || 5,
        String(item.description || '').trim()
      );
      created++;
    }
    return { created, errors };
  });

  res.json(importMany(products));
});

module.exports = router;
