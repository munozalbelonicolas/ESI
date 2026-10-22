import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiClock } from 'react-icons/fi';
import { verifyOrderPayment } from '../services/paymentService';

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order') || params.get('external_reference');
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending'>('checking');

  useEffect(() => {
    if (!orderId) { setStatus('pending'); return; }
    let cancelled = false;
    // La verificación real la hace el servidor contra Mercado Pago (no confiamos en la URL).
    // Reintenta unas veces porque el pago puede tardar unos segundos en acreditarse.
    (async () => {
      for (let i = 0; i < 4 && !cancelled; i++) {
        try {
          const s = await verifyOrderPayment(orderId);
          if (s === 'approved') { if (!cancelled) setStatus('approved'); return; }
        } catch { /* se reintenta */ }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) setStatus('pending');
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const approved = status === 'approved';

  return (
    <div className="section" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container" style={{ maxWidth: 500 }}>
        {approved
          ? <FiCheckCircle size={72} style={{ color: 'var(--color-success)', marginBottom: 24 }} />
          : <FiClock size={72} style={{ color: 'var(--color-text-muted)', marginBottom: 24 }} />}
        <h1 style={{ marginBottom: 8 }}>
          {status === 'checking' ? 'Verificando tu pago...' : approved ? '¡Compra realizada!' : 'Pedido registrado'}
        </h1>
        <p style={{ color: 'var(--color-text-light)', marginBottom: 24, fontSize: 'var(--text-lg)' }}>
          {status === 'checking' && 'Estamos confirmando el pago con Mercado Pago.'}
          {approved && 'Tu pago fue acreditado. Ya podés descargar tu material desde Mis pedidos y te enviamos un email con los detalles.'}
          {status === 'pending' && 'Todavía no vemos el pago acreditado. Si ya pagaste, se confirma solo en unos minutos: entrá a Mis pedidos y tocá "Ya pagué, verificar".'}
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
