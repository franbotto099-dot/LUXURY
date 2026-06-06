// Script para poblar la base de datos con datos de ejemplo
// Ejecutar con: node seed.js

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data', 'luxury.db'));
db.exec('PRAGMA foreign_keys = ON');

// Limpiar datos previos (excepto usuarios)
db.exec(`
  DELETE FROM debt_payments;
  DELETE FROM sale_items;
  DELETE FROM sales;
  DELETE FROM expenses;
  DELETE FROM products;
  DELETE FROM customers;
  UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('products','customers','sales','sale_items','expenses','debt_payments');
`);

// ─── PRODUCTOS ──────────────────────────────────────────────────────────────
const insertProduct = db.prepare(`
  INSERT INTO products (name, category, sale_price, cost_price, stock, min_stock, description)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const productos = [
  // Indumentaria
  ['Remera básica blanca', 'Indumentaria', 4500, 2200, 35, 10, 'Talle S/M/L/XL'],
  ['Remera básica negra', 'Indumentaria', 4500, 2200, 28, 10, 'Talle S/M/L/XL'],
  ['Jean slim fit azul', 'Indumentaria', 12900, 6800, 18, 5, 'Talle 38 al 46'],
  ['Jean cargo negro', 'Indumentaria', 14500, 7500, 12, 5, 'Talle 38 al 46'],
  ['Buzo canguro gris', 'Indumentaria', 8900, 4200, 22, 8, 'Unisex S/M/L'],
  ['Campera bomber verde', 'Indumentaria', 19900, 10500, 8, 3, 'Talle S al XL'],
  ['Short deportivo', 'Indumentaria', 5500, 2800, 30, 10, 'Varios colores'],
  ['Vestido floral verano', 'Indumentaria', 11500, 5800, 14, 5, 'Talle S/M/L'],
  // Calzado
  ['Zapatillas urbanas blancas', 'Calzado', 24900, 13500, 10, 3, 'Del 36 al 44'],
  ['Botas cuero negro', 'Calzado', 32500, 17000, 6, 2, 'Del 36 al 42'],
  ['Ojotas goma', 'Calzado', 3900, 1800, 40, 15, 'Del 35 al 44'],
  // Accesorios
  ['Gorra con logo', 'Accesorios', 3200, 1400, 25, 8, 'Ajustable'],
  ['Cinturón cuero marrón', 'Accesorios', 5800, 2700, 18, 5, 'Talle único'],
  ['Cartera mini negra', 'Accesorios', 8900, 4200, 12, 4, 'Con tira'],
  ['Bufanda lana gris', 'Accesorios', 4500, 2000, 20, 6, 'Invierno'],
  // Stock bajo para mostrar alerta
  ['Tapado lana camel', 'Indumentaria', 28900, 15000, 2, 5, 'Edición limitada'],
  ['Mocasines cuero', 'Calzado', 21500, 11000, 1, 3, 'Del 37 al 43'],
];

const productIds = {};
for (const p of productos) {
  const r = insertProduct.run(...p);
  productIds[p[0]] = r.lastInsertRowid;
}
console.log(`✓ ${productos.length} productos insertados`);

// ─── CLIENTES ────────────────────────────────────────────────────────────────
const insertCustomer = db.prepare(`
  INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)
`);

const clientes = [
  ['María González', '11-4523-8901', 'maria.g@gmail.com', 'Cliente frecuente'],
  ['Carlos Rodríguez', '11-3387-2244', '', 'Le gustan las camperas'],
  ['Sofía Martínez', '11-6612-9900', 'sofi.m@hotmail.com', ''],
  ['Lucas Fernández', '11-7741-5533', '', 'Siempre paga al fiado'],
  ['Valentina López', '11-2298-4477', 'valen.l@gmail.com', 'Talle S en ropa'],
  ['Nicolás Pérez', '11-8854-3322', '', ''],
];

const customerIds = [];
for (const c of clientes) {
  const r = insertCustomer.run(...c);
  customerIds.push(r.lastInsertRowid);
}
console.log(`✓ ${clientes.length} clientes insertados`);

// ─── VENTAS Y MOVIMIENTOS (últimos 30 días) ──────────────────────────────────
const insertSale = db.prepare(`
  INSERT INTO sales (customer_id, total, payment_method, notes, date) VALUES (?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`
  INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateStock = db.prepare(`
  UPDATE products SET stock = stock - ? WHERE id = ?
`);
const insertExpense = db.prepare(`
  INSERT INTO expenses (category, amount, description, date) VALUES (?, ?, ?, ?)
`);

// Función para fecha N días atrás
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const doSale = (customerId, items, method, notes, date) => {
  db.exec('BEGIN');
  try {
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const r = insertSale.run(customerId, total, method, notes, date);
    const saleId = r.lastInsertRowid;
    for (const i of items) {
      insertItem.run(saleId, i.pid, i.name, i.qty, i.price, i.price * i.qty);
      updateStock.run(i.qty, i.pid);
    }
    db.exec('COMMIT');
    return saleId;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
};

// Ventas de los últimos 30 días
const ventas = [
  // Hace 28 días
  { date: daysAgo(28), cid: customerIds[0], items: [{ pid: 1, name: 'Remera básica blanca', qty: 2, price: 4500 }, { pid: 12, name: 'Gorra con logo', qty: 1, price: 3200 }], method: 'cash', notes: '' },
  { date: daysAgo(27), cid: null, items: [{ pid: 9, name: 'Zapatillas urbanas blancas', qty: 1, price: 24900 }], method: 'card', notes: '' },
  { date: daysAgo(26), cid: customerIds[1], items: [{ pid: 6, name: 'Campera bomber verde', qty: 1, price: 19900 }, { pid: 3, name: 'Jean slim fit azul', qty: 1, price: 12900 }], method: 'transfer', notes: 'Transferencia Mercado Pago' },
  { date: daysAgo(25), cid: null, items: [{ pid: 7, name: 'Short deportivo', qty: 3, price: 5500 }], method: 'cash', notes: '' },
  { date: daysAgo(24), cid: customerIds[3], items: [{ pid: 4, name: 'Jean cargo negro', qty: 1, price: 14500 }, { pid: 2, name: 'Remera básica negra', qty: 2, price: 4500 }], method: 'credit', notes: 'Fiado — cobrar viernes' },
  // Hace 20-15 días
  { date: daysAgo(21), cid: customerIds[2], items: [{ pid: 8, name: 'Vestido floral verano', qty: 1, price: 11500 }, { pid: 14, name: 'Cartera mini negra', qty: 1, price: 8900 }], method: 'cash', notes: '' },
  { date: daysAgo(20), cid: null, items: [{ pid: 1, name: 'Remera básica blanca', qty: 1, price: 4500 }, { pid: 2, name: 'Remera básica negra', qty: 1, price: 4500 }, { pid: 11, name: 'Ojotas goma', qty: 2, price: 3900 }], method: 'card', notes: '' },
  { date: daysAgo(18), cid: customerIds[4], items: [{ pid: 5, name: 'Buzo canguro gris', qty: 1, price: 8900 }], method: 'transfer', notes: '' },
  { date: daysAgo(17), cid: null, items: [{ pid: 9, name: 'Zapatillas urbanas blancas', qty: 1, price: 24900 }, { pid: 13, name: 'Cinturón cuero marrón', qty: 1, price: 5800 }], method: 'cash', notes: '' },
  { date: daysAgo(15), cid: customerIds[3], items: [{ pid: 15, name: 'Bufanda lana gris', qty: 2, price: 4500 }], method: 'credit', notes: '' },
  // Última semana
  { date: daysAgo(7), cid: customerIds[0], items: [{ pid: 3, name: 'Jean slim fit azul', qty: 1, price: 12900 }, { pid: 1, name: 'Remera básica blanca', qty: 2, price: 4500 }], method: 'transfer', notes: '' },
  { date: daysAgo(6), cid: null, items: [{ pid: 10, name: 'Botas cuero negro', qty: 1, price: 32500 }], method: 'card', notes: '' },
  { date: daysAgo(5), cid: customerIds[5], items: [{ pid: 6, name: 'Campera bomber verde', qty: 1, price: 19900 }, { pid: 12, name: 'Gorra con logo', qty: 1, price: 3200 }], method: 'cash', notes: '' },
  { date: daysAgo(4), cid: null, items: [{ pid: 7, name: 'Short deportivo', qty: 2, price: 5500 }, { pid: 11, name: 'Ojotas goma', qty: 3, price: 3900 }], method: 'cash', notes: '' },
  { date: daysAgo(3), cid: customerIds[2], items: [{ pid: 8, name: 'Vestido floral verano', qty: 2, price: 11500 }], method: 'card', notes: '' },
  { date: daysAgo(2), cid: null, items: [{ pid: 5, name: 'Buzo canguro gris', qty: 1, price: 8900 }, { pid: 4, name: 'Jean cargo negro', qty: 1, price: 14500 }], method: 'transfer', notes: '' },
  { date: daysAgo(1), cid: customerIds[0], items: [{ pid: 9, name: 'Zapatillas urbanas blancas', qty: 1, price: 24900 }], method: 'cash', notes: '' },
  // Hoy
  { date: daysAgo(0), cid: null, items: [{ pid: 1, name: 'Remera básica blanca', qty: 3, price: 4500 }, { pid: 2, name: 'Remera básica negra', qty: 2, price: 4500 }], method: 'cash', notes: '' },
  { date: daysAgo(0), cid: customerIds[4], items: [{ pid: 14, name: 'Cartera mini negra', qty: 1, price: 8900 }, { pid: 15, name: 'Bufanda lana gris', qty: 1, price: 4500 }], method: 'transfer', notes: '' },
];

for (const v of ventas) {
  doSale(v.cid, v.items, v.method, v.notes, v.date);
}
console.log(`✓ ${ventas.length} ventas insertadas`);

// ─── GASTOS ──────────────────────────────────────────────────────────────────
const gastos = [
  ['Alquiler', 85000, 'Alquiler local comercial', daysAgo(28)],
  ['Proveedores', 42000, 'Reposición remeras y buzos', daysAgo(25)],
  ['Servicios', 4200, 'Factura de luz', daysAgo(22)],
  ['Transporte', 3500, 'Flete mercadería proveedor', daysAgo(20)],
  ['Proveedores', 31500, 'Compra calzado temporada', daysAgo(15)],
  ['Marketing', 8000, 'Publicidad Instagram', daysAgo(12)],
  ['Servicios', 2100, 'Internet local', daysAgo(10)],
  ['Mantenimiento', 5500, 'Arreglo vidrieras', daysAgo(7)],
  ['Proveedores', 18000, 'Accesorios varios', daysAgo(5)],
  ['Sueldos', 120000, 'Sueldo empleada', daysAgo(1)],
  ['Otros', 1800, 'Bolsas y packaging', daysAgo(0)],
];

for (const g of gastos) {
  insertExpense.run(...g);
}
console.log(`✓ ${gastos.length} gastos insertados`);

// ─── PAGO PARCIAL de deuda (Lucas Fernández) ─────────────────────────────────
const insertPayment = db.prepare(`
  INSERT INTO debt_payments (sale_id, customer_id, amount, date, notes)
  VALUES (?, ?, ?, ?, ?)
`);
// Venta 5 (fiado de Lucas) — pago parcial de $10.000
const debtSale = db.prepare("SELECT id FROM sales WHERE payment_method = 'credit' LIMIT 1").get();
if (debtSale) {
  insertPayment.run(debtSale.id, customerIds[3], 10000, daysAgo(10), 'Pago parcial en efectivo');
  console.log('✓ Pago parcial registrado para Lucas Fernández');
}

// ─── RESUMEN FINAL ────────────────────────────────────────────────────────────
const totalSales = db.prepare("SELECT COUNT(*) as c, SUM(total) as t FROM sales").get();
const totalProducts = db.prepare("SELECT COUNT(*) as c FROM products WHERE active=1").get();
const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM customers").get();
const totalExpenses = db.prepare("SELECT SUM(amount) as t FROM expenses").get();

console.log('\n═══════════════════════════════════');
console.log('       BASE DE DATOS LISTA');
console.log('═══════════════════════════════════');
console.log(`  Productos:  ${totalProducts.c}`);
console.log(`  Clientes:   ${totalCustomers.c}`);
console.log(`  Ventas:     ${totalSales.c} (Total: $${totalSales.t?.toLocaleString('es-AR')})`);
console.log(`  Gastos:     $${totalExpenses.t?.toLocaleString('es-AR')}`);
console.log('═══════════════════════════════════');
