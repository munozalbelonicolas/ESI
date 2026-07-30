import { useState, useEffect } from 'react';
import { getAllCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../services/couponService';
import { formatPrice } from '../../utils/formatPrice';
import { formatDateShort } from '../../utils/formatDate';
import type { Coupon, CouponFormData } from '../../types/coupon';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormData>({ code: '', type: 'percentage', value: 10, minPurchase: 0, maxUses: 0, isActive: true, expiresAt: null });

  const loadCoupons = async () => { setCoupons(await getAllCoupons()); setLoading(false); };
  useEffect(() => { loadCoupons(); }, []);

  const resetForm = () => { setForm({ code: '', type: 'percentage', value: 10, minPurchase: 0, maxUses: 0, isActive: true, expiresAt: null }); setEditingId(null); setShowForm(false); };

  const handleEdit = (c: Coupon) => {
    setForm({ code: c.code, type: c.type, value: c.value, minPurchase: c.minPurchase, maxUses: c.maxUses, isActive: c.isActive, expiresAt: c.expiresAt ? c.expiresAt.toDate().toISOString().split('T')[0] : null });
    setEditingId(c.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) { await updateCoupon(editingId, form); toast.success('Cupón actualizado'); }
      else { await createCoupon(form); toast.success('Cupón creado'); }
      resetForm(); loadCoupons();
    } catch { toast.error('Error al guardar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cupón?')) return;
    await deleteCoupon(id); toast.success('Eliminado'); loadCoupons();
  };

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Cupones ({coupons.length})</h1>
        <button className="btn btn--primary" onClick={() => { resetForm(); setShowForm(true); }}><FiPlus /> Nuevo cupón</button>
      </div>

      {showForm && (
        <div className="admin-form" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3>{editingId ? 'Editar cupón' : 'Nuevo cupón'}</h3>
            <button onClick={resetForm} className="btn btn--ghost btn--icon"><FiX /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Código</label>
                <input className="form-input" value={form.code} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="DESCUENTO10" required style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valor ({form.type === 'percentage' ? '%' : '$'})</label>
                <input className="form-input" type="number" value={form.value} onChange={e => update('value', Number(e.target.value))} min={0} required />
              </div>
              <div className="form-group">
                <label className="form-label">Compra mínima ($)</label>
                <input className="form-input" type="number" value={form.minPurchase} onChange={e => update('minPurchase', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Usos máximos (0 = ilimitado)</label>
                <input className="form-input" type="number" value={form.maxUses} onChange={e => update('maxUses', Number(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de vencimiento</label>
                <input className="form-input" type="date" value={form.expiresAt || ''} onChange={e => update('expiresAt', e.target.value || null)} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={form.isActive} onChange={e => update('isActive', e.target.checked)} /> Activo
            </label>
            <div className="admin-form__actions">
              <button type="submit" className="btn btn--primary">{editingId ? 'Guardar' : 'Crear cupón'}</button>
              <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Mín. compra</th><th>Usos</th><th>Estado</th><th>Vence</th><th>Acciones</th></tr></thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{c.code}</td>
                <td>{c.type === 'percentage' ? 'Porcentaje' : 'Fijo'}</td>
                <td>{c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value)}</td>
                <td>{c.minPurchase > 0 ? formatPrice(c.minPurchase) : '—'}</td>
                <td>{c.usedCount}{c.maxUses > 0 ? ` / ${c.maxUses}` : ''}</td>
                <td>{c.isActive ? <span className="badge badge--free">Activo</span> : <span className="badge badge--out">Inactivo</span>}</td>
                <td>{c.expiresAt ? formatDateShort(c.expiresAt) : 'Sin vencimiento'}</td>
                <td>
                  <div className="admin-table__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(c)}><FiEdit2 /></button>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDelete(c.id)} style={{ color: 'var(--color-error)' }}><FiTrash2 /></button>
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
