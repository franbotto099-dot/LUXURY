const path = require('path');
const fs = require('fs');

// En Vercel el filesystem es de solo lectura excepto /tmp
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

// En Vercel/Linux usa better-sqlite3; en Windows dev usa node:sqlite
try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(DATA_DIR, 'luxury.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch {
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(path.join(DATA_DIR, 'luxury.db'));
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');
  // Adaptar API para que sea compatible con better-sqlite3
  db = raw;
  db.transaction = function(fn) {
    return function(...args) {
      db.exec('BEGIN');
      try { const r = fn(...args); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    };
  };
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    sale_price REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT DEFAULT '',
    date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debt_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    amount REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
  CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
  CREATE INDEX IF NOT EXISTS idx_debt_payments_sale_id ON debt_payments(sale_id);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
`);

module.exports = db;
