# Treinta — Gestión financiera para tu negocio

App web responsive para gestionar ventas, inventario, clientes y reportes de un pequeño negocio.

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- npm v9 o superior

---

## Instalación (primera vez)

```bash
# 1. Instalar dependencias del proyecto raíz
npm install

# 2. Instalar dependencias del servidor
cd server && npm install

# 3. Instalar dependencias del cliente
cd ../client && npm install

# 4. Volver a la raíz
cd ..
```

O más fácil, desde la raíz:
```bash
npm run install:all
```

---

## Ejecutar en desarrollo

Desde la raíz del proyecto, abre **dos terminales**:

**Terminal 1 — Servidor:**
```bash
cd server && npm run dev
```

**Terminal 2 — Cliente:**
```bash
cd client && npm run dev
```

O con ambos a la vez (requiere `concurrently` instalado en la raíz):
```bash
npm run dev
```

La app queda disponible en: **http://localhost:5173**

---

## Credenciales por defecto

| Usuario | Contraseña |
|---------|-----------|
| admin   | admin123  |

> **Importante:** Cambiá la contraseña desde el perfil una vez que ingreses.

---

## Estructura del proyecto

```
treinta.co/
├── server/              # Backend Node.js + Express
│   └── src/
│       ├── index.js     # Servidor principal
│       ├── db.js        # SQLite + esquema de tablas
│       ├── middleware/
│       │   └── auth.js  # JWT middleware
│       └── routes/
│           ├── auth.js
│           ├── products.js
│           ├── customers.js
│           ├── sales.js
│           ├── expenses.js
│           └── reports.js
├── client/              # Frontend React + Vite + Tailwind
│   └── src/
│       ├── App.tsx
│       ├── api/         # Funciones de llamada a la API
│       ├── components/  # Componentes reutilizables
│       ├── pages/       # Dashboard, Sales, Inventory, Customers, Reports
│       ├── store/       # Zustand (auth)
│       └── types/       # TypeScript types
├── data/                # SQLite database (se crea automáticamente)
└── package.json
```

---

## Importar productos desde CSV

El CSV debe tener estas columnas (el orden no importa):

```
name,sale_price,cost_price,stock,category,min_stock,description
Coca-Cola 500ml,300,180,50,Bebidas,10,Botella 500ml
Agua mineral,150,80,100,Bebidas,20,
```

Columnas equivalentes aceptadas: `nombre`, `precio_venta`, `precio_costo`, `categoria`, `minimo`.

---

## Migrar a PostgreSQL (futuro)

1. Reemplazá `better-sqlite3` por `pg` o `@vercel/postgres`
2. Adaptá las queries en `server/src/db.js` (sintaxis muy similar)
3. Las diferencias principales: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `date('now', 'localtime')` → `CURRENT_DATE`

---

## Módulos disponibles

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/` | Resumen del día, gráficos, top productos, deudas |
| Ventas | `/ventas` | Caja del día, nueva venta, gastos |
| Inventario | `/inventario` | CRUD de productos, alertas de stock, CSV |
| Clientes | `/clientes` | Gestión de clientes, deudas, pagos |
| Reportes | `/reportes` | Balance, gráficos, ranking, exportar PDF/Excel |

---

## Variables de entorno (server/.env)

```env
JWT_SECRET=tu_clave_secreta_muy_larga
PORT=3001
NODE_ENV=development
```
