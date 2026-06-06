import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShoppingCart, TrendingDown, Banknote, CreditCard, Smartphone, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTodaySummary, createSale, createExpense, deleteSale, deleteExpense, getProducts, getCustomers, getExpenseCategories } from '../api';
import type { SaleItem } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'credit', label: 'Al fiado' },
];
const METHOD_LABELS: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: 'Fiado' };
const METHOD_BADGES: Record<string, 'green' | 'blue' | 'purple' | 'yellow'> = { cash: 'green', card: 'blue', transfer: 'purple', credit: 'yellow' };

export default function Sales() {
  const qc = useQueryClient();
  const { data: summary, isLoading } = useQuery({ queryKey: ['today'], queryFn: getTodaySummary, refetchInterval: 15000 });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => getProducts() });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => getCustomers() });
  const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: getExpenseCategories });

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Sale form state
  const [items, setItems] = useState<SaleItem[]>([{ product_id: null, product_name: '', quantity: 1, price: 0, subtotal: 0 }]);
  const [payMethod, setPayMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Expense form state
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['today'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: () => { toast.success('Venta registrada'); setShowSaleModal(false); resetSale(); invalidate(); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: () => toast.error('Error al registrar la venta'),
  });

  const expenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { toast.success('Gasto registrado'); setShowExpenseModal(false); setExpCategory(''); setExpAmount(''); setExpDesc(''); invalidate(); },
    onError: () => toast.error('Error al registrar el gasto'),
  });

  const deleteSaleMutation = useMutation({
    mutationFn: deleteSale,
    onSuccess: () => { toast.success('Venta eliminada'); invalidate(); qc.invalidateQueries({ queryKey: ['products'] }); },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { toast.success('Gasto eliminado'); invalidate(); },
  });

  const resetSale = () => {
    setItems([{ product_id: null, product_name: '', quantity: 1, price: 0, subtotal: 0 }]);
    setPayMethod('cash');
    setCustomerId('');
    setSaleNotes('');
  };

  const updateItem = (idx: number, field: keyof SaleItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === 'product_id' && value) {
        const p = products?.find(p => p.id === Number(value));
        if (p) { item.product_name = p.name; item.price = p.sale_price; }
      }
      item.subtotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
      next[idx] = item;
      return next;
    });
  };

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const submitSale = () => {
    const validItems = items.filter(i => i.product_name && i.quantity > 0 && i.price > 0);
    if (validItems.length === 0) return toast.error('Agregá al menos un producto');
    if (payMethod === 'credit' && !customerId) return toast.error('Seleccioná un cliente para ventas al fiado');
    saleMutation.mutate({ items: validItems, payment_method: payMethod, customer_id: customerId ? Number(customerId) : null, notes: saleNotes });
  };

  const submitExpense = () => {
    if (!expCategory || !expAmount) return toast.error('Completá categoría y monto');
    expenseMutation.mutate({ category: expCategory, amount: Number(expAmount), description: expDesc });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  const s = summary!;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Caja del día</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowExpenseModal(true)}>
            <TrendingDown size={15} /> Gasto
          </Button>
          <Button size="sm" onClick={() => setShowSaleModal(true)}>
            <Plus size={15} /> Venta
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Ingresos</p>
          <p className="text-lg font-bold text-green-600">{fmt(s.total_sales)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-gray-500">Egresos</p>
          <p className="text-lg font-bold text-red-500">{fmt(s.total_expenses)}</p>
        </Card>
        <Card className={`p-3 text-center ${s.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-500">Balance</p>
          <p className={`text-lg font-bold ${s.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(s.balance)}</p>
        </Card>
      </div>

      {/* Payment methods breakdown */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Por método de pago</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(s.by_method).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                {k === 'cash' && <Banknote size={14} className="text-green-500" />}
                {k === 'card' && <CreditCard size={14} className="text-blue-500" />}
                {k === 'transfer' && <Smartphone size={14} className="text-purple-500" />}
                {k === 'credit' && <Clock size={14} className="text-yellow-500" />}
                <span className="text-xs text-gray-600">{METHOD_LABELS[k]}</span>
              </div>
              <span className="text-xs font-semibold text-gray-800">{fmt(v)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Transactions */}
      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Transacciones de hoy ({s.transactions.length})</h3>
        </div>
        {s.transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin movimientos hoy. ¡Registrá tu primera venta!</p>
        ) : (
          <div className="divide-y">
            {s.transactions.map((t, i) => (
              <div key={i} className="flex items-start justify-between p-3 hover:bg-gray-50">
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${t.type === 'sale' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {t.type === 'sale' ? <ShoppingCart size={12} className="text-green-600" /> : <TrendingDown size={12} className="text-red-500" />}
                  </div>
                  <div className="min-w-0">
                    {t.type === 'sale' ? (
                      <>
                        <p className="text-sm font-medium text-gray-800 truncate">{t.items_summary || 'Venta'}</p>
                        {t.customer_name && <p className="text-xs text-gray-400">{t.customer_name}</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-800">{t.payment_method}</p>
                        {t.notes && <p className="text-xs text-gray-400 truncate">{t.notes}</p>}
                      </>
                    )}
                    <p className="text-xs text-gray-400">{fmtTime(t.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {t.type === 'sale' && <Badge label={METHOD_LABELS[t.payment_method] || t.payment_method} variant={METHOD_BADGES[t.payment_method] || 'gray'} />}
                  <span className={`text-sm font-semibold ${t.type === 'sale' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'sale' ? '+' : '-'}{fmt(Math.abs(t.amount))}
                  </span>
                  <button
                    onClick={() => {
                      if (!confirm('¿Eliminar este registro?')) return;
                      t.type === 'sale' ? deleteSaleMutation.mutate(t.id) : deleteExpenseMutation.mutate(t.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL: Nueva venta */}
      <Modal open={showSaleModal} onClose={() => { setShowSaleModal(false); resetSale(); }} title="Nueva venta" size="lg">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Productos</label>
              <button
                onClick={() => setItems(p => [...p, { product_id: null, product_name: '', quantity: 1, price: 0, subtotal: 0 }])}
                className="text-xs text-green-600 hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Agregar línea
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-end">
                <div className="col-span-5">
                  <select
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none bg-white"
                    value={item.product_id ?? ''}
                    onChange={e => {
                      updateItem(idx, 'product_id', e.target.value ? Number(e.target.value) : 0);
                      if (!e.target.value) updateItem(idx, 'product_name', '');
                    }}
                  >
                    <option value="">Producto libre...</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                  </select>
                </div>
                {!item.product_id && (
                  <div className="col-span-3">
                    <input
                      placeholder="Nombre"
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-green-500 outline-none"
                      value={item.product_name}
                      onChange={e => updateItem(idx, 'product_name', e.target.value)}
                    />
                  </div>
                )}
                <div className={item.product_id ? 'col-span-2' : 'col-span-1'}>
                  <input
                    type="number" min="1"
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-green-500 outline-none text-center"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number" min="0" step="0.01" placeholder="Precio"
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-green-500 outline-none"
                    value={item.price || ''}
                    onChange={e => updateItem(idx, 'price', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm font-semibold border-t pt-2">
            <span className="text-gray-600">Total</span>
            <span className="text-lg text-green-600">{fmt(total)}</span>
          </div>

          <Select
            label="Método de pago"
            value={payMethod}
            onChange={e => setPayMethod(e.target.value)}
            options={METHODS}
          />

          {payMethod === 'credit' && (
            <Select
              label="Cliente (requerido para fiado)"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              options={customers?.map(c => ({ value: String(c.id), label: c.name })) || []}
              placeholder="Seleccionar cliente..."
            />
          )}

          {payMethod !== 'credit' && (
            <Select
              label="Cliente (opcional)"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              options={customers?.map(c => ({ value: String(c.id), label: c.name })) || []}
              placeholder="Sin cliente..."
            />
          )}

          <Input label="Notas (opcional)" value={saleNotes} onChange={e => setSaleNotes(e.target.value)} placeholder="Obs..." />

          <Button onClick={submitSale} loading={saleMutation.isPending} className="w-full">
            Registrar venta {total > 0 && `— ${fmt(total)}`}
          </Button>
        </div>
      </Modal>

      {/* MODAL: Nuevo gasto */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Registrar gasto">
        <div className="space-y-4">
          <Select
            label="Categoría"
            value={expCategory}
            onChange={e => setExpCategory(e.target.value)}
            options={categories?.map(c => ({ value: c, label: c })) || []}
            placeholder="Seleccionar..."
          />
          <Input label="Monto" type="number" min="0" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" />
          <Input label="Descripción" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Opcional..." />
          <Button onClick={submitExpense} loading={expenseMutation.isPending} className="w-full">
            Registrar gasto
          </Button>
        </div>
      </Modal>
    </div>
  );
}
