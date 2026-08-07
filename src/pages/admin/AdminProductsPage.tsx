import { useState, useEffect } from 'react';
import { getAllProducts, createProduct, updateProduct, deleteProduct } from '../../services/productService';
import { uploadProductImage } from '../../services/storageService';
import { formatPrice } from '../../utils/formatPrice';
import type { Product, ProductFormData } from '../../types/product';
import { PRODUCT_CATEGORIES } from '../../types/product';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUploadCloud, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>({
    name: '', description: '', shortDescription: '', price: 0, compareAtPrice: null,
    isFree: false, category: PRODUCT_CATEGORIES[0], images: [], stock: -1,
    isDigital: true, digitalFileUrl: null, weightGrams: 500, customShippingPrice: null,
    transferDiscountPercent: null, isActive: true, tags: [],
  });

  const loadProducts = async () => {
    const data = await getAllProducts();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { loadProducts(); }, []);

  const resetForm = () => {
    setForm({
      name: '', description: '', shortDescription: '', price: 0, compareAtPrice: null,
      isFree: false, category: PRODUCT_CATEGORIES[0], images: [], stock: -1,
      isDigital: true, digitalFileUrl: null, weightGrams: 500, customShippingPrice: null,
      transferDiscountPercent: null, isActive: true, tags: []
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p: Product) => {
    setForm({
      name: p.name, description: p.description, shortDescription: p.shortDescription,
      price: p.price, compareAtPrice: p.compareAtPrice, isFree: p.isFree, category: p.category,
      images: p.images, stock: p.stock, isDigital: p.isDigital, digitalFileUrl: p.digitalFileUrl,
      weightGrams: p.weightGrams ?? 500, customShippingPrice: p.customShippingPrice ?? null,
      transferDiscountPercent: p.transferDiscountPercent ?? null,
      isActive: p.isActive, tags: p.tags
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidFiles = files.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toast.error('Todos los archivos deben ser imágenes válidas');
      return;
    }

    try {
      setUploadingImages(true);
      toast.loading(`Subiendo ${files.length} imagen(es)...`, { id: 'prod-img-upload' });

      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await uploadProductImage(file, 'products');
        uploadedUrls.push(url);
      }

      setForm(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
      toast.success('Imágenes subidas a Cloudinary', { id: 'prod-img-upload' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al subir imágenes', { id: 'prod-img-upload' });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove)
    }));
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
            <div className="admin-form-row admin-form-row--4">
              <div className="form-group">
                <label className="form-label">Precio ($)</label>
                <input className="form-input" type="number" value={form.price} onChange={e => update('price', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Precio anterior ($)</label>
                <input className="form-input" type="number" value={form.compareAtPrice || ''} onChange={e => update('compareAtPrice', e.target.value ? Number(e.target.value) : null)} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Desc. Transferencia (%)</label>
                <input className="form-input" type="number" placeholder="Ej: 5" value={form.transferDiscountPercent || ''} onChange={e => update('transferDiscountPercent', e.target.value ? Number(e.target.value) : null)} min={0} max={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Stock (-1 = ilimitado)</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => update('stock', Number(e.target.value))} />
              </div>
            </div>
            <div className="admin-form-row admin-form-row--2">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={form.category} onChange={e => update('category', e.target.value)}>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Imágenes del Producto</label>
                <label
                  className="btn btn--ghost"
                  style={{ border: '2px dashed var(--color-border)', width: '100%', justifyContent: 'center', cursor: 'pointer', padding: '16px', marginBottom: 12 }}
                >
                  {uploadingImages ? <FiLoader className="spinner" /> : <FiUploadCloud style={{ marginRight: 8 }} />}
                  {uploadingImages ? 'Subiendo imágenes...' : 'Subir una o varias imágenes'}
                  <input type="file" accept="image/*" multiple onChange={handleImagesUpload} style={{ display: 'none' }} disabled={uploadingImages} />
                </label>

                {form.images.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                    {form.images.map((imgUrl, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '100%', paddingTop: '100%', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                        <img src={imgUrl} alt={`Prod ${idx}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          style={{
                            position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: 'white',
                            border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Eliminar imagen"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isFree} onChange={e => update('isFree', e.target.checked)} /> Gratis
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isDigital}
                  onChange={e => {
                    const digital = e.target.checked;
                    setForm(prev => ({
                      ...prev,
                      isDigital: digital,
                      stock: digital ? -1 : (prev.stock === -1 ? 10 : prev.stock)
                    }));
                  }}
                /> Digital
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} /> Activo
              </label>
            </div>

            {(form.isDigital || form.isFree) && (
              <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #86efac' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 'var(--text-sm)', color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔗 Link de descarga (Google Drive u otro)
                </h4>
                <input
                  className="form-input"
                  type="url"
                  value={form.digitalFileUrl || ''}
                  onChange={e => update('digitalFileUrl', e.target.value || null)}
                  placeholder="https://drive.google.com/file/d/..."
                />
                <span style={{ fontSize: 'var(--text-xs)', color: '#166534', marginTop: 4, display: 'block' }}>
                  {form.isFree
                    ? '📢 Este link será visible de inmediato en la página del producto (es gratuito).'
                    : '🔒 Este link solo será visible al comprador cuando el pago sea aprobado.'}
                </span>
              </div>
            )}

            {!form.isDigital && (
              <div style={{ background: 'var(--color-bg-alt)', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid var(--color-border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--text-sm)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  📦 Configuración de Envío Correo Argentino (Producto Físico)
                </h4>
                <div className="admin-form-row admin-form-row--2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Peso unitario (gramos)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={form.weightGrams ?? 500}
                      onChange={e => update('weightGrams', Number(e.target.value))}
                      min={10}
                      placeholder="Ej: 350"
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Peso de 1 unidad (ej: 350g). El sistema acumula los gramos en el carrito.
                    </span>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Tarifa fija de envío opcional ($)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={form.customShippingPrice || ''}
                      onChange={e => update('customShippingPrice', e.target.value ? Number(e.target.value) : null)}
                      min={0}
                      placeholder="Dejar vacío para cálculo automático"
                    />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Si completás este valor, se usará tarifa fija en lugar del cálculo por CP.
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="admin-form__actions">
              <button type="submit" className="btn btn--primary" disabled={uploadingImages}>{editingId ? 'Guardar cambios' : 'Crear producto'}</button>
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
