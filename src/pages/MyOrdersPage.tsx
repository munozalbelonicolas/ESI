import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { getUserOrders, deleteOrder } from '../services/orderService';
import { createMPPreference } from '../services/paymentService';
import { formatPrice } from '../utils/formatPrice';
import { formatDateShort } from '../utils/formatDate';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../types/order';
import type { Order } from '../types/order';
import { FiPackage, FiCreditCard, FiArrowRight, FiTrash2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function MyOrdersPage() {
  const { firebaseUser } = useAuthContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    getUserOrders(firebaseUser.uid)
      .then((data) => {
        const hidden: string[] = JSON.parse(localStorage.getItem('esi_hidden_orders') || '[]');
        setOrders(data.filter((o) => !hidden.includes(o.id)));
      })
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  const handlePayOrder = async (order: Order) => {
    setPayingId(order.id);
    try {
      const pref = await createMPPreference(
        order.id,
        order.items,
        firebaseUser?.email || order.userEmail || '',
        order.shippingCost || 0,
        order.discount || 0
      );
      const redirectUrl = pref.initPoint || pref.sandboxInitPoint;
      if (redirectUrl) {
        toast.success('Redirigiendo a Mercado Pago...');
        window.location.href = redirectUrl;
        return;
      }
      throw new Error('No se obtuvo la URL de pago.');
    } catch (err: any) {
      console.error('[MyOrdersPage] Error pagando orden:', err);
      toast.error(err.message || 'Error al conectar con Mercado Pago. Intentá de nuevo.');
    } finally {
      setPayingId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('¿Estás seguro de que querés eliminar esta compra?')) return;
    setDeletingId(orderId);
    try {
      await deleteOrder(orderId);
    } catch (err: any) {
      console.warn('[MyOrdersPage] No se pudo borrar en Firestore, ocultando localmente:', err);
    } finally {
      // Guardar ID en localStorage para ocultarla siempre
      const hidden: string[] = JSON.parse(localStorage.getItem('esi_hidden_orders') || '[]');
      if (!hidden.includes(orderId)) {
        hidden.push(orderId);
        localStorage.setItem('esi_hidden_orders', JSON.stringify(hidden));
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Compra eliminada correctamente');
      setDeletingId(null);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="section">
      <div className="container">
        <h1 style={{ marginBottom: 'var(--space-xl)' }}>Mis pedidos</h1>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
            <FiPackage size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
            <h3>Todavía no tenés pedidos</h3>
            <Link to="/tienda" className="btn btn--primary" style={{ marginTop: 16 }}>
              Ver recursos <FiArrowRight />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.map((o) => {
              const isPendingPayment = o.paymentStatus !== 'approved' && o.status !== 'cancelled';
              const isMP = o.paymentMethod === 'mercadopago';

              return (
                <div
                  key={o.id}
                  style={{
                    background: 'var(--color-white)',
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                        Orden #{o.id.slice(0, 8)}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 12 }}>
                        {formatDateShort(o.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        className={`badge badge--${
                          o.status === 'paid' || o.status === 'delivered' ? 'free' : o.status === 'cancelled' ? 'out' : 'new'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                      <span
                        className={`badge badge--${
                          o.paymentStatus === 'approved' ? 'free' : o.paymentStatus === 'rejected' ? 'out' : 'sale'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {o.items.map((item, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 'var(--text-sm)',
                          background: 'var(--color-bg-alt)',
                          padding: '4px 10px',
                          borderRadius: 20,
                          color: 'var(--color-text)',
                        }}
                      >
                        {item.name} x{item.quantity}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      borderTop: '1px solid var(--color-border-light)',
                      paddingTop: 12,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                      Total: {formatPrice(o.total)}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() => handleDeleteOrder(o.id)}
                        disabled={deletingId === o.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: '#dc2626',
                          borderColor: '#fca5a5',
                          backgroundColor: '#fef2f2',
                        }}
                      >
                        <FiTrash2 size={15} />
                        {deletingId === o.id ? 'Eliminando...' : 'Eliminar compra'}
                      </button>

                      {isPendingPayment && (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => handlePayOrder(o)}
                          disabled={payingId === o.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          {payingId === o.id ? 'Procesando...' : 'Finalizar compra'} <FiArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
