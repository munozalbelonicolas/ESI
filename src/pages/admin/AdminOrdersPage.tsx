import { useState, useEffect } from 'react';
import { getAllOrders, updateOrderStatus, updatePaymentStatus } from '../../services/orderService';
import { getTransferProof } from '../../services/storageService';
import { formatPrice } from '../../utils/formatPrice';
import { formatDateTime } from '../../utils/formatDate';
import { ORDER_STATUS_LABELS } from '../../types/order';
import type { Order, OrderStatus, PaymentStatus } from '../../types/order';
import { FiImage, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [proofModal, setProofModal] = useState<string | null>(null); // imageData
  const [loadingProof, setLoadingProof] = useState<string | null>(null);

  const loadOrders = async () => { setOrders(await getAllOrders()); setLoading(false); };
  useEffect(() => { loadOrders(); }, []);

  const handleViewProof = async (orderId: string) => {
    setLoadingProof(orderId);
    try {
      const imageData = await getTransferProof(orderId);
      if (imageData) {
        setProofModal(imageData);
      } else {
        toast.error('No se encontró el comprobante');
      }
    } catch {
      toast.error('Error al cargar el comprobante');
    } finally {
      setLoadingProof(null);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
    if (status === 'paid') {
      await updatePaymentStatus(orderId, 'approved');
    }
    toast.success('Estado actualizado');
    loadOrders();
  };

  const handlePaymentChange = async (orderId: string, paymentStatus: PaymentStatus) => {
    await updatePaymentStatus(orderId, paymentStatus);
    toast.success('Estado de pago actualizado');
    loadOrders();
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Órdenes ({orders.length})</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => (
            <button key={s} className={`filter-chip ${filter === s ? 'filter-chip--active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'Todas' : ORDER_STATUS_LABELS[s as OrderStatus]}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead><tr><th>Orden</th><th>Cliente</th><th>Items</th><th>Total</th><th>Pago</th><th>Estado</th><th>Comprobante</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>#{o.id.slice(0, 8)}</td>
                <td>
                  <div>{o.userName}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{o.userEmail}</div>
                </td>
                <td>{o.items.length} items</td>
                <td style={{ fontWeight: 700 }}>{formatPrice(o.total)}</td>
                <td>
                  <select className="form-select" value={o.paymentStatus} onChange={e => handlePaymentChange(o.id, e.target.value as PaymentStatus)} style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', minWidth: 100 }}>
                    <option value="pending">Pendiente</option>
                    <option value="approved">Aprobado</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </td>
                <td>
                  <select className="form-select" value={o.status} onChange={e => handleStatusChange(o.id, e.target.value as OrderStatus)} style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', minWidth: 100 }}>
                    {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {o.paymentMethod === 'transfer' ? (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleViewProof(o.id)}
                      disabled={loadingProof === o.id}
                    >
                      {loadingProof === o.id ? '...' : <><FiImage /> Ver</>}
                    </button>
                  ) : (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>MP</span>
                  )}
                </td>
                <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{formatDateTime(o.createdAt)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal comprobante */}
      {proofModal && (
        <div
          onClick={() => setProofModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 24,
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setProofModal(null)}
              style={{
                position: 'absolute', top: -16, right: -16,
                background: 'white', border: 'none', borderRadius: '50%',
                width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiX />
            </button>
            <img
              src={proofModal}
              alt="Comprobante de transferencia"
              style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
