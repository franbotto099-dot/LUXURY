import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBalance, getProductsRanking, getIncomeExpensesChart } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = now.toISOString().split('T')[0];
  return { from, to };
}

export default function Reports() {
  const defaultRange = getMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('month');

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ['balance', from, to],
    queryFn: () => getBalance(from, to),
    enabled: !!from && !!to,
  });

  const { data: ranking } = useQuery({
    queryKey: ['ranking', from, to],
    queryFn: () => getProductsRanking({ from, to, limit: 10 }),
  });

  const { data: chartData } = useQuery({
    queryKey: ['chart', chartPeriod],
    queryFn: () => getIncomeExpensesChart(chartPeriod),
  });

  const exportPDF = () => {
    if (!balance) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte de Balance — LUXURY', 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${from} al ${to}`, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [['Concepto', 'Monto']],
      body: [
        ['Total Ventas', fmt(balance.sales.total)],
        ['  - Efectivo', fmt(balance.sales.by_method.cash)],
        ['  - Tarjeta', fmt(balance.sales.by_method.card)],
        ['  - Transferencia', fmt(balance.sales.by_method.transfer)],
        ['  - Al fiado', fmt(balance.sales.by_method.credit)],
        ['Total Gastos', fmt(balance.expenses.total)],
        ['Balance neto', fmt(balance.balance)],
      ],
    });

    if (balance.expenses.by_category?.length > 0) {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
        head: [['Categoría de gastos', 'Total']],
        body: balance.expenses.by_category.map((c: { category: string; total: number }) => [c.category, fmt(c.total)]),
      });
    }

    if (ranking?.length > 0) {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
        head: [['Producto', 'Unidades', 'Ingresos']],
        body: ranking.map((r: { product_name: string; total_qty: number; total_revenue: number }) => [r.product_name, r.total_qty, fmt(r.total_revenue)]),
      });
    }

    doc.save(`reporte-luxury-${from}-${to}.pdf`);
    toast.success('PDF generado');
  };

  const exportExcel = () => {
    if (!balance) return;
    const wb = XLSX.utils.book_new();

    const balData = [
      ['Balance General', '', ''],
      ['Período', `${from} al ${to}`, ''],
      ['', '', ''],
      ['Concepto', 'Monto', ''],
      ['Total Ventas', balance.sales.total, ''],
      ['  Efectivo', balance.sales.by_method.cash, ''],
      ['  Tarjeta', balance.sales.by_method.card, ''],
      ['  Transferencia', balance.sales.by_method.transfer, ''],
      ['  Al fiado', balance.sales.by_method.credit, ''],
      ['Total Gastos', balance.expenses.total, ''],
      ['Balance', balance.balance, ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(balData), 'Balance');

    if (balance.expenses.by_category?.length > 0) {
      const expData = [['Categoría', 'Total'], ...balance.expenses.by_category.map((c: { category: string; total: number }) => [c.category, c.total])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), 'Gastos por categoría');
    }

    if (ranking?.length > 0) {
      const rankData = [['Producto', 'Unidades', 'Ingresos', 'Ventas'], ...ranking.map((r: { product_name: string; total_qty: number; total_revenue: number; num_sales: number }) => [r.product_name, r.total_qty, r.total_revenue, r.num_sales])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rankData), 'Productos');
    }

    XLSX.writeFile(wb, `reporte-luxury-${from}-${to}.xlsx`);
    toast.success('Excel generado');
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportPDF} disabled={!balance}>
            <FileText size={14} /> PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={exportExcel} disabled={!balance}>
            <FileSpreadsheet size={14} /> Excel
          </Button>
        </div>
      </div>

      {/* Date range */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 outline-none" />
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Esta semana', fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); setFrom(mon.toISOString().split('T')[0]); setTo(d.toISOString().split('T')[0]); } },
              { label: 'Este mes', fn: () => { const { from, to } = getMonthRange(); setFrom(from); setTo(to); } },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} className="px-3 py-2 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 whitespace-nowrap">{label}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* Balance summary */}
      {loadingBalance ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
      ) : balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ventas', value: fmt(balance.sales.total), icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Gastos', value: fmt(balance.expenses.total), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100' },
            { label: 'Balance', value: fmt(balance.balance), icon: DollarSign, color: balance.balance >= 0 ? 'text-blue-600' : 'text-red-600', bg: balance.balance >= 0 ? 'bg-blue-100' : 'bg-red-100' },
            { label: 'Transacciones', value: String(balance.sales.count), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-lg font-bold ${color} mt-0.5`}>{value}</p>
                </div>
                <div className={`p-1.5 rounded-lg ${bg}`}><Icon size={16} className={color} /></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Ingresos vs Egresos</h2>
            <div className="flex gap-1">
              {(['week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setChartPeriod(p)} className={`px-2 py-1 text-xs rounded-lg ${chartPeriod === p ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {p === 'week' ? '7d' : '30d'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={fmtDate} />
                <Bar dataKey="sales" name="Ventas" fill="#16a34a" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {balance?.expenses?.by_category?.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Gastos por categoría</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={balance.expenses.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={60} label={({ category, percent }: { category: string; percent: number }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                    {balance.expenses.by_category.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Product ranking */}
      {ranking && ranking.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Productos más vendidos</h2>
          <div className="space-y-2">
            {ranking.map((p: { product_name: string; total_qty: number; total_revenue: number }, i: number) => {
              const maxQty = ranking[0].total_qty;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-gray-700 truncate">{p.product_name}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs text-gray-400">{p.total_qty} u.</span>
                        <span className="text-xs font-semibold text-gray-700">{fmt(p.total_revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(p.total_qty / maxQty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Payment methods breakdown */}
      {balance?.sales && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Ventas por método de pago</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(balance.sales.by_method) as [string, number][]).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 capitalize">{k === 'cash' ? 'Efectivo' : k === 'card' ? 'Tarjeta' : k === 'transfer' ? 'Transferencia' : 'Fiado'}</p>
                <p className="text-base font-bold text-gray-800 mt-1">{fmt(v)}</p>
                {balance.sales.total > 0 && <p className="text-xs text-gray-400">{((v / balance.sales.total) * 100).toFixed(0)}%</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
