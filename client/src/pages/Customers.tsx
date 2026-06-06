import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Search, ChevronRight, Pencil, Trash2, Users, Phone, ArrowLeft, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCustomers, getCustomersWithDebt, getCustomer, getCustomerSales, getCustomerDebts, createCustomer, updateCustomer, deleteCustomer, registerPayment } from '../api';
import type { Customer } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const EMPTY_FORM = { name: '', phone: '', email: '', notes: '' };

// Customer detail view
function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const numId = Number(id);

  const { data: customer, isLoading } = useQuery({ queryKey: ['customer', numId], queryFn: () => getCustomer(numId) });
  const { data: sales } = useQuery({ queryKey: ['customer-sales', numId], queryFn: () => getCustomerSales(numId) });
  const { data: debts } = useQuery({ queryKey: ['customer-debts', numId], queryFn: () => getCustomerDebts(numId) });

  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<{ sale_id: number; remaining: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const paymentMutation = useMutation({
    mutationFn: (data: { sale_id: number; amount: number; notes?: string }) => registerPayment(numId, data),
    onSuccess: () => {
      toast.success('Pago registrado');
      setShowPayModal(false);
      setPayAmount('');
      setPayNotes('');
      qc.invalidateQueries({ queryKey: ['customer', numId] });
      qc.invalidateQueries({ queryKey: ['customer-debts', numId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Error al registrar pago'),
  });

  const openPay = (debt: { sale_id: number; remaining: number }) => {
    setSelectedDebt(debt);
    setPayAmount(String(debt.remaining));
    setShowPayModal(true);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  if (!customer) return <div className="p-4 text-center text-gray-500">Cliente no encontrado</div>;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{customer.name}</h1>
          {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
        </div>
      </div>

      {(customer.total_debt ?? 0) > 0 && (
        <Card className="p-4 bg-red-50 border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Deuda pendiente</p>
              <p className="text-2xl font-bold text-red-600">{fmt(customer.total_debt!)}</p>
            </div>
            <DollarSign size={24} className="text-red-400" />
          </div>
        </Card>
      )}

      {/* Debts */}
      {debts && debts.length > 0 && (
        <Card>
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Cuentas pendientes</h2>
          </div>
          <div className="divide-y">
            {debts.map(d => (
              <div key={d.sale_id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Compra del {fmtDate(d.date)}</p>
                  <p className="text-xs text-gray-400">Total: {fmt(d.total)} • Pagado: {fmt(d.paid)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-500">{fmt(d.remaining)}</span>
                  <Button size="sm" onClick={() => openPay({ sale_id: d.sale_id, remaining: d.remaining })}>
                    Cobrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sales history */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Historial de compras ({sales?.length ?? 0})</h2>
        </div>
        {!sales?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin compras registradas</p>
        ) : (
          <div className="divide-y">
            {sales.map(s => (
              <div key={s.id} className="p-4 flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{s.items_summary || '—'}</p>
                  <p className="text-xs text-gray-400">{fmtDate(s.date)}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge label={s.payment_method === 'credit' ? 'Fiado' : s.payment_method === 'cash' ? 'Efectivo' : s.payment_method} variant={s.payment_method === 'credit' ? 'yellow' : 'green'} />
                  <span className="text-sm font-semibold text-gray-800">{fmt(s.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Registrar pago">
        <div className="space-y-4">
          {selectedDebt && (
            <p className="text-sm text-gray-500">Deuda pendiente: <strong>{fmt(selectedDebt.remaining)}</strong></p>
          )}
          <Input
            label="Monto a cobrar"
            type="number" min="0" step="0.01"
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
          />
          <Input label="Notas" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Opcional..." />
          <Button
            onClick={() => {
              if (!selectedDebt || !payAmount) return;
              paymentMutation.mutate({ sale_id: selectedDebt.sale_id, amount: Number(payAmount), notes: payNotes });
            }}
            loading={paymentMutation.isPending}
            className="w-full"
          >
            Confirmar cobro
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Customers list
export default function Customers() {
  const { id } = useParams();
  if (id) return <CustomerDetail />;

  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showDebt, setShowDebt] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => getCustomers(search ? { search } : undefined),
  });
  const { data: debtors } = useQuery({ queryKey: ['customers-debt'], queryFn: getCustomersWithDebt });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => { toast.success('Cliente creado'); setShowModal(false); qc.invalidateQueries({ queryKey: ['customers'] }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) => updateCustomer(id, data),
    onSuccess: () => { toast.success('Cliente actualizado'); setShowModal(false); qc.invalidateQueries({ queryKey: ['customers'] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => { toast.success('Cliente eliminado'); qc.invalidateQueries({ queryKey: ['customers'] }); },
  });

  const openCreate = () => { setEditCustomer(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c: Customer) => { setEditCustomer(c); setForm({ name: c.name, phone: c.phone, email: c.email, notes: c.notes }); setShowModal(true); };

  const handleSubmit = () => {
    if (!form.name) return toast.error('Nombre requerido');
    editCustomer ? updateMutation.mutate({ id: editCustomer.id, data: form }) : createMutation.mutate(form);
  };

  const displayList = showDebt ? (debtors || []) : (customers || []);
  const totalDebt = debtors?.reduce((s, c) => s + (c.total_debt ?? 0), 0) ?? 0;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{customers?.length ?? 0} registrados</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Agregar</Button>
      </div>

      {totalDebt > 0 && (
        <button
          onClick={() => setShowDebt(p => !p)}
          className={`w-full flex items-center justify-between rounded-xl p-3 text-sm border transition-colors ${showDebt ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'}`}
        >
          <div className="flex items-center gap-2">
            <DollarSign size={15} />
            <span>Total por cobrar: <strong>{fmt(totalDebt)}</strong> ({debtors?.length} clientes)</span>
          </div>
          <span className="text-xs">{showDebt ? '× Ver todos' : 'Solo con deuda →'}</span>
        </button>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por nombre, teléfono..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
      ) : displayList.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes" description="Agregá tu primer cliente para llevar un registro de ventas" action={{ label: '+ Agregar cliente', onClick: openCreate }} />
      ) : (
        <Card>
          <div className="divide-y">
            {displayList.map(c => (
              <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.phone && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone size={11} />{c.phone}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {(c.total_debt ?? 0) > 0 && (
                    <Badge label={fmt(c.total_debt!)} variant="red" />
                  )}
                  <button
                    onClick={e => { e.preventDefault(); openEdit(c); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={e => { e.preventDefault(); confirm('¿Eliminar cliente?') && deleteMutation.mutate(c.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editCustomer ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del cliente" />
          <Input label="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+54 11 1234-5678" type="tel" />
          <Input label="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@ejemplo.com" type="email" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 resize-none"
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Opcional..."
            />
          </div>
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editCustomer ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
