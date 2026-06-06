import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, AlertTriangle, Package } from 'lucide-react';
import { getDashboard, getIncomeExpensesChart } from '../api';
import Card from '../components/ui/Card';
import { Link } from 'react-router-dom';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string; subtitle?: string; icon: typeof DollarSign; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const { data: dash, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 30000 });
  const { data: chart } = useQuery({ queryKey: ['chart', period], queryFn: () => getIncomeExpensesChart(period) });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  const d = dash!;
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Buenos días 👋</h1>
        <p className="text-sm text-gray-500 capitalize">{today}</p>
      </div>

      {d.low_stock_count > 0 && (
        <Link to="/inventario?low_stock=true" className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span><strong>{d.low_stock_count} producto{d.low_stock_count > 1 ? 's' : ''}</strong> con stock bajo. Revisá el inventario.</span>
        </Link>
      )}

      {/* Hoy */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Hoy</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Ventas del día" value={fmt(d.today.sales)} subtitle={`${d.today.count} transacciones`} icon={ShoppingCart} color="bg-green-100 text-green-600" />
          <StatCard title="Gastos del día" value={fmt(d.today.expenses)} icon={TrendingDown} color="bg-red-100 text-red-500" />
          <StatCard title="Balance del día" value={fmt(d.today.balance)} icon={DollarSign} color={d.today.balance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-500'} />
          <StatCard title="Ventas del mes" value={fmt(d.month.sales)} subtitle={`${d.month.count} ventas`} icon={TrendingUp} color="bg-purple-100 text-purple-600" />
        </div>
      </div>

      {/* Gráfico */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Ingresos vs Egresos</h2>
          <div className="flex gap-1">
            {(['week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${period === p ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {p === 'week' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={fmtDate} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="sales" name="Ventas" stroke="#16a34a" fill="url(#sales)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#ef4444" fill="url(#expenses)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top productos */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-green-600" />
            <h2 className="text-sm font-semibold text-gray-900">Más vendidos (mes)</h2>
          </div>
          {d.top_products.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin ventas este mes</p>
          ) : (
            <div className="space-y-2">
              {d.top_products.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-700 truncate">{p.product_name}</span>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <span className="text-xs font-medium text-gray-900">{p.total_qty} u.</span>
                    <span className="text-xs text-gray-400 ml-1">{fmt(p.total_revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top deudores */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-900">Cuentas por cobrar</h2>
            </div>
            <Link to="/clientes" className="text-xs text-green-600 hover:underline">Ver todo</Link>
          </div>
          {d.top_debtors.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin deudas pendientes</p>
          ) : (
            <div className="space-y-2">
              {d.top_debtors.map((c) => (
                <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                  </div>
                  <span className="text-sm font-semibold text-red-500 ml-2 shrink-0">{fmt(c.debt)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
