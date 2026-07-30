import { useState, useEffect } from 'react';
import { getAllProducts, createProduct, updateProduct, deleteProduct } from '../../services/productService';
import { formatPrice } from '../../utils/formatPrice';
import type { Product, ProductFormData } from '../../types/product';
import { PRODUCT_CATEGORIES } from '../../types/product';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>({
    name: '', description: '', shortDescription: '', price: 0, compareAtPrice: null,
    isFree: false, category: PRODUCT_CATEGORIES[0], images: [], stock: -1,
    isDigital: true, digitalFileUrl: null, isActive: true, tags: [],
  });

  const loadProducts = async () => {
    const data = await getAllProducts();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { loadProducts(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', shortDescription: '', price: 0, compareAtPrice: null, isFree: false, category: PRODUCT_CATEGORIES[0], images: [], stock: -1, isDigital: true, digitalFileUrl: null, isActive: true, tags: [] });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description, shortDescription: p.shortDescription, price: p.price, compareAtPrice: p.compareAtPrice, isFree: p.isFree, category: p.category, images: p.images, stock: p.stock, isDigital: p.isDigital, digitalFileUrl: p.digitalFileUrl, isActive: p.isActive, tags: p.tags });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateProduct(editingId, form);
        toast.success('Producto actualizado');
      } else {
        await createProduct(form);
        toast.success('Producto creado');
      }
      resetForm();
      loadProducts();
    } catch { toast.error('Error al guardar producto'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await deleteProduct(id);
      toast.success('Producto eliminado');
      loadProducts();
    } catch { toast.error('Error al eliminar'); }
  };

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Productos ({products.length})</h1>
        <button className="btn btn--primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus /> Nuevo producto
        </button>
      </div>

      {showForm && (
        <div className="admin-form" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3>{editingId ? 'Editar producto' : 'Nuevo producto'}</h3>
            <button onClick={resetForm} className="btn btn--ghost btn--icon"><FiX /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción corta</label>
              <input className="form-input" value={form.shortDescription} onChange={e => update('shortDescription', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción completa (HTML)</label>
              <textarea className="form-textarea" value={form.description} onChange={e => update('description', e.target.value)} rows={6} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Precio ($)</label>
                <input className="form-input" type="number" value={form.price} onChange={e => update('price', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Precio anterior ($)</label>
                <input className="form-input" type="number" value={form.compareAtPrice || ''} onChange={e => update('compareAtPrice', e.target.value ? Number(e.target.value) : null)} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Stock (-1 = ilimitado)</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => update('stock', Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={form.category} onChange={e => update('category', e.target.value)}>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">URLs de imágenes (una por línea)</label>
                <textarea className="form-textarea" value={form.images.join('\n')} onChange={e => update('images', e.target.value.split('\n').filter(Boolean))} rows={3} placeholder="https://..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isFree} onChange={e => update('isFree', e.target.checked)} /> Gratis
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isDigital} onChange={e => update('isDigital', e.target.checked)} /> Digital
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} /> Activo
              </label>
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="btn btn--primary">{editingId ? 'Guardar cambios' : 'Crear producto'}</button>
              <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.isFree ? <span className="badge badge--free">Gratis</span> : formatPrice(p.price)}</td>
                <td>{p.isDigital ? <span className="badge badge--digital">Digital</span> : p.stock === 0 ? <span className="badge badge--out">Sin stock</span> : p.stock}</td>
                <td>{p.isActive ? <span className="badge badge--free">Activo</span> : <span className="badge badge--out">Inactivo</span>}</td>
                <td>
                  <div className="admin-table__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(p)}><FiEdit2 /></button>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-error)' }}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
