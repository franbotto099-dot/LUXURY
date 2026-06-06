# Treinta — Documentación para Claude Code

## Stack tecnológico

**Backend:** Node.js (CommonJS) + Express 4 + better-sqlite3 (SQLite)
- Sin TypeScript en el servidor (puro JS para evitar compilación)
- Autenticación JWT con bcryptjs
- Todas las queries son SQL directo (no ORM) — fácil de migrar a PostgreSQL

**Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS 3
- React Query v5 para data fetching y caché
- Zustand para estado de autenticación
- React Router v6 para navegación
- Recharts para gráficos
- jsPDF + jspdf-autotable para exportar PDF
- xlsx para exportar Excel
- PapaParse para importar CSV
- lucide-react para iconos
- react-hot-toast para notificaciones

## Estructura de archivos importantes

```
server/src/
  index.js          — Servidor Express, configuración de rutas
  db.js             — Inicializa SQLite, crea tablas e índices
  middleware/auth.js — Verifica JWT en requests protegidos
  routes/
    auth.js         — Login, cambio de contraseña, /me
    products.js     — CRUD productos, import CSV, low-stock
    customers.js    — CRUD clientes, deudas, pagos
    sales.js        — Ventas, caja del día, historial
    expenses.js     — Gastos con categorías
    reports.js      — Dashboard, gráficos, balance, ranking

client/src/
  App.tsx           — Router principal, QueryClient, rutas protegidas
  api/index.ts      — Todas las funciones de API (wrappers de axios)
  api/client.ts     — Instancia axios con interceptors JWT
  store/auth.ts     — Zustand store: token, username, setAuth, logout
  types/index.ts    — TypeScript interfaces: Product, Customer, Sale, etc.
  components/
    Layout.tsx      — Sidebar desktop + bottom nav mobile
    ui/             — Button, Input, Select, Modal, Card, Badge, EmptyState
  pages/
    Login.tsx       — Formulario de login
    Dashboard.tsx   — Resumen del día + mes, gráfico área, top products/debtors
    Sales.tsx       — Caja del día, nueva venta (multi-item), nuevo gasto
    Inventory.tsx   — Grilla de productos, filtros, alertas stock, import CSV
    Customers.tsx   — Lista + detalle cliente con deudas y pagos
    Reports.tsx     — Balance por período, gráficos, ranking, export PDF/Excel
```

## Base de datos (SQLite)

Archivo: `data/treinta.db` (se crea automáticamente al iniciar el servidor)

**Tablas principales:**
- `users` — solo una fila (uso personal)
- `products` — activos/inactivos con soft-delete
- `customers` — clientes con datos de contacto
- `sales` — ventas con métodos: cash, card, transfer, credit
- `sale_items` — líneas de cada venta (descuenta stock automáticamente)
- `expenses` — gastos por categoría
- `debt_payments` — pagos parciales/totales de ventas al fiado

**Índices:** date en sales/expenses, sale_id en sale_items, customer_id en debt_payments.

## Flujos críticos

### Registrar una venta
1. POST `/api/sales` con `{ items[], payment_method, customer_id?, notes?, date? }`
2. El servidor usa una transacción SQLite: inserta la venta, los items y descuenta el stock
3. Si `payment_method = 'credit'`, la deuda queda pendiente en `debt_payments` (via `customers/:id/payments`)

### Deuda de clientes
- La deuda se calcula como: `SUM(ventas credit) - SUM(debt_payments)` — nunca se guarda un campo "deuda" directo
- GET `/api/customers/with-debt` lista solo clientes con saldo pendiente > 0

### Dashboard
- GET `/api/reports/dashboard` — una sola query optimizada para la pantalla de inicio
- Se refresca cada 30s con React Query `refetchInterval`

## Comandos de desarrollo

```bash
# Servidor (desde /server)
npm run dev        # nodemon src/index.js

# Cliente (desde /client)  
npm run dev        # vite dev server en :5173
npm run build      # build de producción

# Raíz (ambos juntos)
npm run dev        # concurrently
```

## Variables de entorno

`server/.env`:
```
JWT_SECRET=clave_secreta_larga
PORT=3001
NODE_ENV=development
```

## Notas de arquitectura

- El cliente usa proxy de Vite en dev: `/api/*` → `localhost:3001/api/*`
- El JWT expira en 7 días; el interceptor de axios redirige a `/login` si recibe 401
- Los productos eliminados se marcan con `active = 0` (soft delete) para preservar histórico de ventas
- El stock se descuenta en una transacción atómica al crear la venta y se restaura al eliminarla
- SQLite con WAL mode y foreign_keys ON para mejor concurrencia y integridad referencial

## Mejoras pendientes para v2

1. **Proveedores:** CRUD + órdenes de compra + cuentas por pagar
2. **Multi-usuario:** roles (admin/vendedor) con permisos diferentes  
3. **Backup automático:** exportar DB completa con un click
4. **PWA / modo offline:** Service Worker para caching de lecturas
5. **Notificaciones push:** stock crítico, cobros pendientes vencidos
6. **Historial de precios:** tracking de cambios en precios de productos
7. **Turnos de caja:** apertura/cierre con fondo y arqueo
8. **Facturación:** generación de recibos/facturas básicas
9. **Integración con MercadoPago:** confirmación automática de transferencias
10. **PostgreSQL en producción:** instrucciones de migración y deploy en Railway/Render
