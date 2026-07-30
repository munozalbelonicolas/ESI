import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');

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
