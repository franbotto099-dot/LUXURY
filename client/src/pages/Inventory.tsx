import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, Upload, Pencil, Trash2, Package, X } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, importProducts, getLowStockProducts } from '../api';
import type { Product } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useSearchParams } from 'react-router-dom';

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const EMPTY_FORM = { name: '', category: '', sale_price: '', cost_price: '', stock: '', min_stock: '5', description: '', image_url: '' };

const isValidImageSrc = (url: string) => url.startsWith('data:') || url.startsWith('http') || url.startsWith('https') || url.startsWith('/');

export default function Inventory() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('low_stock') === 'true');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dragOver, setDragOver] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search, category, lowStockFilter],
    queryFn: () => getProducts({
      ...(search && { search }),
      ...(category && { category }),
      ...(lowStockFilter && { low_stock: 'true' }),
    }),
  });
  const { data: categories } = useQuery({ queryKey: ['product-categories'], queryFn: getCategories });
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: getLowStockProducts });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => { toast.success('Producto creado'); setShowModal(false); invalidate(); qc.invalidateQueries({ queryKey: ['product-categories'] }); },
    onError: () => toast.error('Error al crear el producto'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => updateProduct(id, data),
    onSuccess: () => { toast.success('Producto actualizado'); setShowModal(false); invalidate(); qc.invalidateQueries({ queryKey: ['product-categories'] }); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => { toast.success('Producto eliminado'); invalidate(); },
  });

  const importMutation = useMutation({
    mutationFn: importProducts,
    onSuccess: (r) => { toast.success(`${r.created} productos importados`); if (r.errors.length > 0) toast.error(r.errors.slice(0, 3).join('\n')); invalidate(); },
    onError: () => toast.error('Error al importar'),
  });

  const openCreate = () => { setEditProduct(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, category: p.category, sale_price: String(p.sale_price), cost_price: String(p.cost_price), stock: String(p.stock), min_stock: String(p.min_stock), description: p.description, image_url: p.image_url || '' });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.sale_price) return toast.error('Nombre y precio de venta requeridos');
    const data = { name: form.name, category: form.category, sale_price: Number(form.sale_price), cost_price: Number(form.cost_price), stock: Number(form.stock), min_stock: Number(form.min_stock), description: form.description, image_url: form.image_url };
    editProduct ? updateMutation.mutate({ id: editProduct.id, data }) : createMutation.mutate(data);
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const mapped = (r.data as Record<string, string>[]).map((row) => ({
          name: row.name || row.nombre || row.Nombre || '',
          category: row.category || row.categoria || row.Categoria || '',
          sale_price: Number(row.sale_price || row.precio_venta || row.precio || 0),
          cost_price: Number(row.cost_price || row.precio_costo || row.costo || 0),
          stock: Number(row.stock || row.Stock || 0),
          min_stock: Number(row.min_stock || row.minimo || 5),
          description: row.description || row.descripcion || '',
        }));
        importMutation.mutate(mapped);
        e.target.value = '';
      },
      error: () => toast.error('Error al leer el CSV'),
    });
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, image_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, image_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const margin = (p: Product) => p.sale_price > 0 ? Math.round(((p.sale_price - p.cost_price) / p.sale_price) * 100) : 0;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500">{products?.length ?? 0} productos</p>
        </div>
        <div className="flex gap-2">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <Button variant="secondary" size="sm" onClick={() => csvRef.current?.click()} loading={importMutation.isPending}>
            <Upload size={14} /> CSV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Agregar
          </Button>
        </div>
      </div>

      {(lowStock?.length ?? 0) > 0 && (
        <button
          onClick={() => setLowStockFilter(p => !p)}
          className={`w-full flex items-center gap-2 rounded-xl p-3 text-sm border transition-colors ${lowStockFilter ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'}`}
        >
          <AlertTriangle size={15} className="shrink-0" />
          <span><strong>{lowStock!.length} producto{lowStock!.length > 1 ? 's' : ''}</strong> con stock bajo o agotado</span>
          <span className="ml-auto text-xs">{lowStockFilter ? '× Quitar filtro' : 'Ver solo estos →'}</span>
        </button>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-green-500 outline-none"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">Todas</option>
          {categories?.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
      ) : products?.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos" description="Agregá tu primer producto o importá desde CSV" action={{ label: '+ Agregar producto', onClick: openCreate }} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products!.map(p => (
            <Card key={p.id} className={p.image_url ? 'overflow-hidden' : 'p-4'}>
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover" />
              )}
              <div className={p.image_url ? 'p-4' : ''}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{p.name}</h3>
                    {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={13} /></button>
                    <button onClick={() => confirm('¿Eliminar producto?') && deleteMutation.mutate(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-gray-900">{fmt(p.sale_price)}</span>
                  {p.cost_price > 0 && <span className="text-xs text-gray-400">Costo: {fmt(p.cost_price)} • {margin(p)}% margen</span>}
                </div>

                <div className="flex items-center gap-2">
                  {p.stock <= 0 ? (
                    <Badge label="Sin stock" variant="red" />
                  ) : p.stock <= p.min_stock ? (
                    <Badge label={`Stock bajo: ${p.stock}`} variant="yellow" />
                  ) : (
                    <Badge label={`Stock: ${p.stock}`} variant="green" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-400 text-center">
        CSV esperado: columnas <code>name, sale_price, cost_price, stock, category, min_stock, description</code>
      </div>

      {/* Product modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editProduct ? 'Editar producto' : 'Nuevo producto'}>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Coca-Cola 500ml" />
          <Input label="Categoría" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Ej: Bebidas" list="categories-list" />
          <datalist id="categories-list">{categories?.map(c => <option key={c} value={c} />)}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio de venta *" type="number" min="0" step="0.01" value={form.sale_price} onChange={e => setForm(p => ({ ...p, sale_price: e.target.value }))} />
            <Input label="Precio de costo" type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock actual" type="number" min="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
            <Input label="Stock mínimo" type="number" min="0" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: e.target.value }))} />
          </div>
          <Input label="Descripción" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Opcional..." />

          {/* Imagen */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Imagen</label>
            {form.image_url && isValidImageSrc(form.image_url) && (
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img src={form.image_url} alt="" className="w-full h-28 object-cover" />
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                  className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-0.5 text-gray-500 hover:text-red-500 shadow-sm"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleImageDrop}
              onClick={() => imgRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed py-3 text-center transition-colors ${dragOver ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'}`}
            >
              <Upload size={16} className="mx-auto mb-1 text-gray-400" />
              <p className="text-xs text-gray-500">Arrastrá una imagen o hacé clic para subir</p>
            </div>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">o pegá una URL</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <input
              type="url"
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
              value={form.image_url.startsWith('data:') ? '' : form.image_url}
              onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
            />
          </div>

          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} className="w-full">
            {editProduct ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
