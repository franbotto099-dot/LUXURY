const express = require('express');
const { db, wrap } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', wrap(async (req, res) => {
  const { search, category, low_stock, active = 1 } = req.query;
  let sql = 'SELECT * FROM products WHERE active = ?';
  const params = [Number(active)];

  if (search) {
    sql += ' AND (name ILIKE ? OR description ILIKE ?)';
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

  res.json(await db.all(sql, params));
}));

router.get('/categories', wrap(async (req, res) => {
  const rows = await db.all("SELECT DISTINCT category FROM products WHERE category != '' AND active = 1 ORDER BY category");
  res.json(rows.map(r => r.category));
}));

router.get('/low-stock', wrap(async (req, res) => {
  res.json(await db.all('SELECT * FROM products WHERE stock <= min_stock AND active = 1 ORDER BY stock ASC'));
}));

router.get('/:id', wrap(async (req, res) => {
  const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
}));

router.post('/', wrap(async (req, res) => {
  const { name, category = '', sale_price, cost_price = 0, stock = 0, min_stock = 5, description = '', image_url = '' } = req.body;
  if (!name || sale_price == null) return res.status(400).json({ error: 'Nombre y precio de venta requeridos' });

  const row = await db.get(
    'INSERT INTO products (name, category, sale_price, cost_price, stock, min_stock, description, image_url) VALUES (?,?,?,?,?,?,?,?) RETURNING *',
    [name.trim(), category.trim(), Number(sale_price), Number(cost_price), Number(stock), Number(min_stock), description.trim(), image_url]
  );
  res.status(201).json(row);
}));

router.put('/:id', wrap(async (req, res) => {
  const existing = await db.get('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, category, sale_price, cost_price, stock, min_stock, description, image_url } = req.body;
  const row = await db.get(`
    UPDATE products SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      sale_price = COALESCE(?, sale_price),
      cost_price = COALESCE(?, cost_price),
      stock = COALESCE(?, stock),
      min_stock = COALESCE(?, min_stock),
      description = COALESCE(?, description),
      image_url = COALESCE(?, image_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING *`,
    [
      name != null ? String(name).trim() : null,
      category != null ? String(category).trim() : null,
      sale_price != null ? Number(sale_price) : null,
      cost_price != null ? Number(cost_price) : null,
      stock != null ? Number(stock) : null,
      min_stock != null ? Number(min_stock) : null,
      description != null ? String(description).trim() : null,
      image_url != null ? image_url : null,
      req.params.id,
    ]
  );
  res.json(row);
}));

router.delete('/:id', wrap(async (req, res) => {
  const existing = await db.get('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  await db.run('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/import', wrap(async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de productos' });
  }

  const result = await db.transaction(async (tx) => {
    let created = 0;
    const errors = [];
    for (const [i, item] of products.entries()) {
      if (!item.name || item.sale_price == null) {
        errors.push(`Fila ${i + 1}: nombre y precio de venta requeridos`);
        continue;
      }
      await tx.run(
        'INSERT INTO products (name, category, sale_price, cost_price, stock, min_stock, description) VALUES (?,?,?,?,?,?,?)',
        [String(item.name).trim(), String(item.category || '').trim(), Number(item.sale_price) || 0, Number(item.cost_price) || 0, Number(item.stock) || 0, Number(item.min_stock) || 5, String(item.description || '').trim()]
      );
      created++;
    }
    return { created, errors };
  });

  res.json(result);
}));

module.exports = router;
