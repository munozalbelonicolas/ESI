import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { getUserOrders, deleteOrder } from '../services/orderService';
import { createMPPreference, verifyOrderPayment, getDigitalDownloadUrl } from '../services/paymentService';
import { formatPrice } from '../utils/formatPrice';
import { formatDateShort } from '../utils/formatDate';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../types/order';
import type { Order } from '../types/order';
import { FiPackage, FiCreditCard, FiArrowRight, FiTrash2, FiDownload } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function MyOrdersPage() {
  const { firebaseUser } = useAuthContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [downloadingItem, setDownloadingItem] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    getUserOrders(firebaseUser.uid)
      .then((data) => {
        const hidden: string[] = JSON.parse(localStorage.getItem('esi_hidden_orders') || '[]');
        const visible = data.filter((o) => !hidden.includes(o.id));
        setOrders(visible);

        // Verificación automática en segundo plano de pedidos de MP sin acreditar
        visible
          .filter((o) => o.paymentMethod === 'mercadopago' && o.paymentStatus !== 'approved' && o.status !== 'cancelled')
          .slice(0, 5)
          .forEach((o) => {
            verifyOrderPayment(o.id)
              .then((s) => {
                if (s === 'approved') {
                  setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, paymentStatus: 'approved', status: 'paid' } : x)));
                }
              })
              .catch(() => {});
          });
      })
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  const handleVerify = async (order: Order) => {
    setVerifyingId(order.id);
    try {
      const s = await verifyOrderPayment(order.id);
      if (s === 'approved') {
        setOrders((prev) => prev.map((x) => (x.id === order.id ? { ...x, paymentStatus: 'approved', status: 'paid' } : x)));
        toast.success('¡Pago confirmado! Ya podés descargar tu material.');
      } else {
        toast('Todavía no vemos el pago acreditado. Probá de nuevo en unos minutos.');
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo verificar el pago');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDownloadItem = async (orderId: string, productId: string, name: string) => {
    const key = `${orderId}_${productId}`;
    setDownloadingItem(key);
    try {
      const url = await getDigitalDownloadUrl(orderId, productId);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('No se encontró el enlace de descarga');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al obtener la descarga');
    } finally {
      setDownloadingItem(null);
    }
  };

  const handlePayOrder = async (order: Order) => {
    setPayingId(order.id);
    try {
      const pref = await createMPPreference(order.id);
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
      console.warn('[MyOrdersPage] No se pudo cancelar el pedido:', err);
      toast.error(err?.message || 'No se pudo cancelar el pedido');
      setDeletingId(null);
      return;
    }
    const hidden: string[] = JSON.parse(localStorage.getItem('esi_hidden_orders') || '[]');
    if (!hidden.includes(orderId)) {
      hidden.push(orderId);
      localStorage.setItem('esi_hidden_orders', JSON.stringify(hidden));
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    toast.success('Pedido cancelado correctamente');
    setDeletingId(null);
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

                  {/* Items del pedido */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {o.items.map((item, i) => {
                      const isPaid = o.paymentStatus === 'approved' || o.status === 'paid';
                      const showDownload = item.isDigital && isPaid;
                      const isBusy = downloadingItem === `${o.id}_${item.productId}`;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
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
                          {showDownload && (
                            <button
                              type="button"
                              onClick={() => handleDownloadItem(o.id, item.productId, item.name)}
                              disabled={isBusy}
                              className="btn btn--primary btn--sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                              title={`Descargar ${item.name}`}
                            >
                              <FiDownload size={13} /> {isBusy ? 'Cargando...' : 'Descargar'}
                            </button>
                          )}
                        </div>
                      );
                    })}
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

                      {isPendingPayment && isMP && (
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => handleVerify(o)}
                          disabled={verifyingId === o.id}
                        >
                          {verifyingId === o.id ? 'Verificando...' : 'Ya pagué, verificar'}
                        </button>
                      )}

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
