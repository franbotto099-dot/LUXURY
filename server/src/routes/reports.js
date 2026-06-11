const express = require('express');
const { db, wrap } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/dashboard', wrap(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.substring(0, 8) + '01';

  const [todaySales, monthSales, todayExpenses, monthExpenses, topProducts, debtors, lowStock] = await Promise.all([
    db.get('SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales WHERE date = ?', [today]),
    db.get('SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales WHERE date >= ?', [firstOfMonth]),
    db.get('SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date = ?', [today]),
    db.get('SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date >= ?', [firstOfMonth]),
    db.all(`
      SELECT si.product_name, SUM(si.quantity) AS total_qty, SUM(si.subtotal) AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.date >= ?
      GROUP BY si.product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `, [firstOfMonth]),
    db.all(`
      SELECT c.id, c.name, c.phone,
        SUM(s.total) - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) AS debt
      FROM customers c
      JOIN sales s ON s.customer_id = c.id AND s.payment_method = 'credit'
      GROUP BY c.id, c.name, c.phone
      HAVING SUM(s.total) - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) > 0
      ORDER BY debt DESC
      LIMIT 5
    `),
    db.get('SELECT COUNT(*) AS count FROM products WHERE stock <= min_stock AND active = 1'),
  ]);

  res.json({
    today: { sales: Number(todaySales.total), expenses: Number(todayExpenses.total), balance: Number(todaySales.total) - Number(todayExpenses.total), count: Number(todaySales.count) },
    month: { sales: Number(monthSales.total), expenses: Number(monthExpenses.total), balance: Number(monthSales.total) - Number(monthExpenses.total), count: Number(monthSales.count) },
    top_products: topProducts,
    top_debtors: debtors,
    low_stock_count: Number(lowStock.count),
  });
}));

router.get('/income-expenses', wrap(async (req, res) => {
  const { period = 'week' } = req.query;
  const days = period === 'month' ? 30 : 7;

  const rows = await db.all(`
    SELECT d::date AS date,
      COALESCE((SELECT SUM(total) FROM sales WHERE date = d::date), 0) AS sales,
      COALESCE((SELECT SUM(amount) FROM expenses WHERE date = d::date), 0) AS expenses
    FROM generate_series(
      CURRENT_DATE - (? || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    ) AS t(d)
    ORDER BY d
  `, [days - 1]);

  res.json(rows);
}));

router.get('/products-ranking', wrap(async (req, res) => {
  const { from, to, limit = 10 } = req.query;
  let sql = `
    SELECT si.product_id, si.product_name,
      SUM(si.quantity) AS total_qty,
      SUM(si.subtotal) AS total_revenue,
      COUNT(DISTINCT si.sale_id) AS num_sales
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE 1=1
  `;
  const params = [];

  if (from) { sql += ' AND s.date >= ?'; params.push(from); }
  if (to) { sql += ' AND s.date <= ?'; params.push(to); }

  sql += ' GROUP BY si.product_id, si.product_name ORDER BY total_qty DESC LIMIT ?';
  params.push(Number(limit));

  res.json(await db.all(sql, params));
}));

router.get('/balance', wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos' });

  const [sales, expenses, expensesByCategory] = await Promise.all([
    db.get(`
      SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash,
        COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) AS card,
        COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END),0) AS transfer,
        COALESCE(SUM(CASE WHEN payment_method='credit' THEN total ELSE 0 END),0) AS credit
      FROM sales WHERE date >= ? AND date <= ?
    `, [from, to]),
    db.get('SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses WHERE date >= ? AND date <= ?', [from, to]),
    db.all('SELECT category, SUM(amount) AS total FROM expenses WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC', [from, to]),
  ]);

  res.json({
    period: { from, to },
    sales: { total: Number(sales.total), count: Number(sales.count), by_method: { cash: Number(sales.cash), card: Number(sales.card), transfer: Number(sales.transfer), credit: Number(sales.credit) } },
    expenses: { total: Number(expenses.total), count: Number(expenses.count), by_category: expensesByCategory },
    balance: Number(sales.total) - Number(expenses.total),
    gross_profit: Number(sales.total) - Number(expenses.total),
  });
}));

module.exports = router;
