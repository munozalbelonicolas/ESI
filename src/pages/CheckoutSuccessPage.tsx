import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';
import { updateOrderStatus, updatePaymentStatus } from '../services/orderService';

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order') || params.get('external_reference');
  const collectionStatus = params.get('collection_status') || params.get('status');

  useEffect(() => {
    // Si Mercado Pago redirige de vuelta con status approved o la orden viene especificada
    if (orderId) {
      if (!collectionStatus || collectionStatus === 'approved') {
        updateOrderStatus(orderId, 'paid').catch(() => {});
        updatePaymentStatus(orderId, 'approved').catch(() => {});
      }
    }
  }, [orderId, collectionStatus]);

  return (
    <div className="section" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container" style={{ maxWidth: 500 }}>
        <FiCheckCircle size={72} style={{ color: 'var(--color-success)', marginBottom: 24 }} />
        <h1 style={{ marginBottom: 8 }}>¡Compra realizada!</h1>
        <p style={{ color: 'var(--color-text-light)', marginBottom: 24, fontSize: 'var(--text-lg)' }}>
          Tu pedido fue registrado correctamente. Te enviamos un email con los detalles.
        </p>
        {orderId && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 24 }}>Nº de orden: {orderId}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/mis-ordenes" className="btn btn--primary">Ver mis pedidos</Link>
          <Link to="/tienda" className="btn btn--outline">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}
