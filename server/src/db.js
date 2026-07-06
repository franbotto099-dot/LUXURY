require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Converts ? placeholders to $1, $2, $3...
function p(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      sale_price NUMERIC NOT NULL DEFAULT 0,
      cost_price NUMERIC NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      description TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      image_url TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      total NUMERIC NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT DEFAULT '',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC NOT NULL DEFAULT 0,
      subtotal NUMERIC NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      amount NUMERIC NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_sale_id ON debt_payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
  `);
}

const initPromise = initDB().catch(err => console.error('Error inicializando DB:', err.message));

const ensureReady = (req, res, next) => initPromise.then(() => next()).catch(next);

const db = {
  get: async (sql, params = []) => {
    const { rows } = await pool.query(p(sql), params);
    return rows[0] || null;
  },
  all: async (sql, params = []) => {
    const { rows } = await pool.query(p(sql), params);
    return rows;
  },
  run: (sql, params = []) => pool.query(p(sql), params),
  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        get: async (sql, params = []) => {
          const { rows } = await client.query(p(sql), params);
          return rows[0] || null;
        },
        all: async (sql, params = []) => {
          const { rows } = await client.query(p(sql), params);
          return rows;
        },
        run: (sql, params = []) => client.query(p(sql), params),
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

const wrap = fn => async (req, res, next) => {
  try { await fn(req, res, next); } catch (e) { next(e); }
};

module.exports = { db, wrap, initPromise, ensureReady };
