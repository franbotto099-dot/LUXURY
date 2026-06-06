const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.substring(0, 8) + '01';

  const todaySales = db.prepare(
    'SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales WHERE date = ?'
  ).get(today);

  const monthSales = db.prepare(
    'SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales WHERE date >= ?'
  ).get(firstOfMonth);

  const todayExpenses = db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date = ?'
  ).get(today);

  const monthExpenses = db.prepare(
    'SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date >= ?'
  ).get(firstOfMonth);

  const topProducts = db.prepare(`
    SELECT si.product_name, SUM(si.quantity) AS total_qty, SUM(si.subtotal) AS total_revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.date >= ?
    GROUP BY si.product_name
    ORDER BY total_qty DESC
    LIMIT 5
  `).all(firstOfMonth);

  const debtors = db.prepare(`
    SELECT c.id, c.name, c.phone,
      SUM(s.total) - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.customer_id = c.id), 0) AS debt
    FROM customers c
    JOIN sales s ON s.customer_id = c.id AND s.payment_method = 'credit'
    GROUP BY c.id
    HAVING debt > 0
    ORDER BY debt DESC
    LIMIT 5
  `).all();

  const lowStock = db.prepare(
    'SELECT COUNT(*) AS count FROM products WHERE stock <= min_stock AND active = 1'
  ).get();

  res.json({
    today: { sales: todaySales.total, expenses: todayExpenses.total, balance: todaySales.total - todayExpenses.total, count: todaySales.count },
    month: { sales: monthSales.total, expenses: monthExpenses.total, balance: monthSales.total - monthExpenses.total, count: monthSales.count },
    top_products: topProducts,
    top_debtors: debtors,
    low_stock_count: lowStock.count
  });
});

router.get('/income-expenses', (req, res) => {
  const { period = 'week' } = req.query;
  let days = period === 'month' ? 30 : 7;

  const rows = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', 'localtime', '-' || ? || ' days')
      UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < date('now', 'localtime')
    )
    SELECT d AS date,
      COALESCE((SELECT SUM(total) FROM sales WHERE date = d), 0) AS sales,
      COALESCE((SELECT SUM(amount) FROM expenses WHERE date = d), 0) AS expenses
    FROM dates ORDER BY d
  `).all(days - 1);

  res.json(rows);
});

router.get('/products-ranking', (req, res) => {
  const { from, to, limit = 10 } = req.query;
  let dateFilter = '';
  const params = [];

  if (from) { dateFilter += ' AND s.date >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND s.date <= ?'; params.push(to); }

  const top = db.prepare(`
    SELECT si.product_id, si.product_name,
      SUM(si.quantity) AS total_qty,
      SUM(si.subtotal) AS total_revenue,
      COUNT(DISTINCT si.sale_id) AS num_sales
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE 1=1 ${dateFilter}
    GROUP BY si.product_name
    ORDER BY total_qty DESC
    LIMIT ?
  `).all(...params, Number(limit));

  res.json(top);
});

router.get('/balance', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos' });

  const sales = db.prepare(`
    SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count,
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) AS card,
      COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END),0) AS transfer,
      COALESCE(SUM(CASE WHEN payment_method='credit' THEN total ELSE 0 END),0) AS credit
    FROM sales WHERE date >= ? AND date <= ?
  `).get(from, to);

  const expenses = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
    FROM expenses WHERE date >= ? AND date <= ?
  `).get(from, to);

  const expensesByCategory = db.prepare(`
    SELECT category, SUM(amount) AS total FROM expenses
    WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC
  `).all(from, to);

  res.json({
    period: { from, to },
    sales: { total: sales.total, count: sales.count, by_method: { cash: sales.cash, card: sales.card, transfer: sales.transfer, credit: sales.credit } },
    expenses: { total: expenses.total, count: expenses.count, by_category: expensesByCategory },
    balance: sales.total - expenses.total,
    gross_profit: sales.total - expenses.total
  });
});

module.exports = router;
