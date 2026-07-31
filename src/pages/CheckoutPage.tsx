import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCartContext } from '../context/CartContext';
import { useAuthContext } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import { validateCoupon, calculateDiscount, incrementCouponUsage } from '../services/couponService';
import { getShippingQuotes, type ShippingQuote } from '../services/shippingService';
import { getBankDetails, type BankDetails } from '../services/bankService';
import { uploadTransferProof } from '../services/storageService';
import { saveTransferProof } from '../services/orderService';
import { createMPPreference, sendPurchaseConfirmation } from '../services/paymentService';
import { formatPrice } from '../utils/formatPrice';
import { trackBeginCheckout, trackPurchase } from '../config/analytics';
import { onPurchaseComplete } from '../services/subscriptionHook';
import { PROVINCES } from '../config/site';
import type { PaymentMethod, ShippingAddress } from '../types/order';
import type { Coupon } from '../types/coupon';
import { FiTruck, FiCreditCard, FiUpload, FiCheck, FiTag, FiCopy, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './CheckoutPage.css';

export default function CheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartContext();
  const { firebaseUser, profile, isEmailVerified } = useAuthContext();
  const navigate = useNavigate();

  const [step, setStep] = useState<'shipping' | 'payment' | 'confirm'>('shipping');
  const [address, setAddress] = useState<ShippingAddress>({ street: '', city: '', province: '', zipCode: '' });
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago');
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getBankDetails().then(setBankDetails);
  }, []);

  useEffect(() => {
    if (profile?.shippingAddress) {
      setAddress({
        street: profile.shippingAddress.street || '',
        city: profile.shippingAddress.city || '',
        province: profile.shippingAddress.province || '',
        zipCode: profile.shippingAddress.zipCode || '',
      });
    }
  }, [profile]);

  const hasDigitalOnly = items.every((i) => i.product.isDigital);
  const totalWeightGrams = items.reduce((acc, i) => {
    if (i.product.isDigital) return acc;
    return acc + (i.product.weightGrams || 500) * i.quantity;
  }, 0);

  const subtotal = getSubtotal();
  const discount = appliedCoupon ? calculateDiscount(appliedCoupon, subtotal) : 0;
  const shippingCost = hasDigitalOnly ? 0 : (selectedShipping?.price || 0);
  const total = subtotal - discount + shippingCost;

  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (items.length === 0) return <Navigate to="/carrito" replace />;

  const handleCalcShipping = async () => {
    if (address.zipCode.length !== 4) { toast.error('Ingresá un código postal válido (4 dígitos)'); return; }
    setLoadingShipping(true);
    try {
      const quotes = await getShippingQuotes(address.zipCode, totalWeightGrams);
      setShippingQuotes(quotes);
      if (quotes.length > 0) setSelectedShipping(quotes[0]);
    } catch { toast.error('Error al calcular envío por Correo Argentino'); }
    setLoadingShipping(false);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const coupon = await validateCoupon(couponCode, subtotal);
    if (coupon) {
      setAppliedCoupon(coupon);
      toast.success(`¡Cupón aplicado! ${coupon.type === 'percentage' ? coupon.value + '%' : formatPrice(coupon.value)} de descuento`);
    } else {
      toast.error('Cupón inválido, expirado o no cumple el monto mínimo');
    }
  };

  const handleSubmit = async () => {
    if (!isEmailVerified) { toast.error('Verificá tu email antes de comprar. Revisá tu casilla.'); return; }
    if (!hasDigitalOnly && !selectedShipping) { toast.error('Seleccioná un método de envío'); return; }
    if (paymentMethod === 'transfer' && !transferFile) { toast.error('Subí el comprobante de transferencia'); return; }

    setProcessing(true);
    trackBeginCheckout(total, items.map(i => ({ item_id: i.product.id, item_name: i.product.name, price: i.product.price, quantity: i.quantity })), appliedCoupon?.code);

    try {
      const orderId = await createOrder({
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || '',
        userName: profile?.displayName || '',
        items: items.map(i => ({
          productId: i.product.id, name: i.product.name, price: i.product.price,
          quantity: i.quantity, isDigital: i.product.isDigital, image: i.product.images[0] || '',
        })),
        subtotal, discount, couponCode: appliedCoupon?.code || null,
        shippingCost, shippingMethod: selectedShipping?.name || 'Digital',
        shippingAddress: hasDigitalOnly ? null : address,
        total, paymentMethod,
      });

      if (appliedCoupon) await incrementCouponUsage(appliedCoupon.id);

      if (paymentMethod === 'transfer' && transferFile) {
        const proofUrl = await uploadTransferProof(transferFile, orderId);
        await saveTransferProof(orderId, proofUrl);
      }

      if (paymentMethod === 'mercadopago') {
        try {
          const pref = await createMPPreference(
            orderId,
            items.map(i => ({ productId: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity, isDigital: i.product.isDigital, image: i.product.images[0] || '' })),
            firebaseUser.email || '',
            shippingCost, discount
          );
          window.location.href = pref.initPoint;
          return;
        } catch {
          toast.error('Error al conectar con Mercado Pago. Tu orden fue creada con pago pendiente.');
        }
      }

      trackPurchase(orderId, total, items.map(i => ({ item_id: i.product.id, item_name: i.product.name, price: i.product.price, quantity: i.quantity })), paymentMethod);
      await onPurchaseComplete({ userId: firebaseUser.uid, email: firebaseUser.email || '', type: 'purchase', productIds: items.map(i => i.product.id), timestamp: new Date() });

      // Enviar email de confirmación al cliente (y copia al admin)
      await sendPurchaseConfirmation({
        orderId,
        userEmail: firebaseUser.email || '',
        userName: profile?.displayName || '',
        items: items.map(i => ({ productId: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity, isDigital: i.product.isDigital, image: i.product.images[0] || '' })),
        total,
        paymentMethod,
      });

      clearCart();
      navigate(`/checkout/exito?order=${orderId}`);
    } catch (err) {
      console.error('Error en checkout:', err);
      toast.error('Error al procesar la compra. Intentá de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="checkout-page section">
      <div className="container">
        <h1>Checkout</h1>
        <div className="checkout-page__grid">
          <div className="checkout-page__form">
            {/* Steps indicator */}
            <div className="checkout-steps">
              {['shipping', 'payment', 'confirm'].map((s, i) => (
                <div key={s} className={`checkout-step ${step === s ? 'checkout-step--active' : ''} ${['shipping','payment','confirm'].indexOf(step) > i ? 'checkout-step--done' : ''}`}>
                  <span className="checkout-step__number">{i + 1}</span>
                  <span className="checkout-step__label">{s === 'shipping' ? 'Envío' : s === 'payment' ? 'Pago' : 'Confirmar'}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Shipping */}
            {step === 'shipping' && (
              <div className="checkout-section animate-fade-in">
                <h3><FiTruck /> Datos de envío</h3>
                {hasDigitalOnly ? (
                  <div className="checkout-digital-note">
                    <FiCheck size={20} /> Todos los productos son digitales. No se requiere envío.
                    <button className="btn btn--primary btn--full" onClick={() => setStep('payment')} style={{ marginTop: 16 }}>
                      Continuar al pago
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Dirección</label>
                        <input className="form-input" value={address.street} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} placeholder="Calle y número" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ciudad</label>
                        <input className="form-input" value={address.city} onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))} placeholder="Localidad" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Provincia</label>
                        <select className="form-select" value={address.province} onChange={e => setAddress(prev => ({ ...prev, province: e.target.value }))} required>
                          <option value="">Seleccionar...</option>
                          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Código postal</label>
                        <input className="form-input" value={address.zipCode} onChange={e => setAddress(prev => ({ ...prev, zipCode: e.target.value }))} placeholder="1234" maxLength={4} required />
                      </div>
                      <div className="form-group">
                        <button className="btn btn--secondary btn--full" onClick={handleCalcShipping} disabled={loadingShipping}>
                          {loadingShipping ? <div className="spinner spinner--sm" /> : 'Calcular envío'}
                        </button>
                      </div>
                    </div>
                    {shippingQuotes.length > 0 && (
                      <div className="shipping-quotes">
                        <h4>Opciones de envío</h4>
                        {shippingQuotes.map(q => (
                          <label key={q.id} className={`shipping-quote ${selectedShipping?.id === q.id ? 'shipping-quote--selected' : ''}`}>
                            <input type="radio" name="shipping" checked={selectedShipping?.id === q.id} onChange={() => setSelectedShipping(q)} />
                            <div className="shipping-quote__info">
                              <span className="shipping-quote__name">{q.name}</span>
                              <span className="shipping-quote__days">{q.estimatedDays}</span>
                            </div>
                            <span className="shipping-quote__price">{formatPrice(q.price)}</span>
                          </label>
                        ))}
                        <button className="btn btn--primary btn--full" onClick={() => setStep('payment')} style={{ marginTop: 16 }}>
                          Continuar al pago
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 2: Payment */}
            {step === 'payment' && (
              <div className="checkout-section animate-fade-in">
                <h3><FiCreditCard /> Método de pago</h3>
                <div className="payment-methods">
                  <label className={`payment-method ${paymentMethod === 'mercadopago' ? 'payment-method--selected' : ''}`}>
                    <input type="radio" name="payment" value="mercadopago" checked={paymentMethod === 'mercadopago'} onChange={() => setPaymentMethod('mercadopago')} />
                    <div>
                      <strong>Mercado Pago</strong>
                      <p>Tarjeta de crédito, débito o dinero en cuenta</p>
                    </div>
                  </label>
                  <label className={`payment-method ${paymentMethod === 'transfer' ? 'payment-method--selected' : ''}`}>
                    <input type="radio" name="payment" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} />
                    <div>
                      <strong>Transferencia bancaria</strong>
                      <p>Transferí y subí el comprobante</p>
                    </div>
                  </label>
                </div>

                {paymentMethod === 'transfer' && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {bankDetails && (
                      <div style={{ background: 'var(--color-bg-alt)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                          <FiCreditCard size={18} style={{ color: 'var(--color-primary)' }} /> Datos para realizar la transferencia
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-xs)' }}>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)' }}>Banco / Entidad: </span>
                            <strong style={{ color: 'var(--color-text)' }}>{bankDetails.bankName}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-text-muted)' }}>Titular: </span>
                            <strong style={{ color: 'var(--color-text)' }}>{bankDetails.accountHolder}</strong>
                          </div>
                          {bankDetails.cuit && (
                            <div>
                              <span style={{ color: 'var(--color-text-muted)' }}>CUIT / CUIL: </span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>{bankDetails.cuit}</span>
                            </div>
                          )}

                          <div style={{ background: 'var(--color-bg)', padding: 10, borderRadius: 8, marginTop: 4, border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>CBU / CVU:</span>
                                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{bankDetails.cbu}</strong>
                              </div>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(bankDetails.cbu);
                                  setCopiedField('CBU');
                                  toast.success('CBU copiado al portapapeles');
                                  setTimeout(() => setCopiedField(null), 2000);
                                }}
                                style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px' }}
                              >
                                {copiedField === 'CBU' ? <FiCheck color="green" /> : <FiCopy />} Copiar
                              </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '10px' }}>ALIAS:</span>
                                <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)' }}>{bankDetails.alias}</strong>
                              </div>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(bankDetails.alias);
                                  setCopiedField('Alias');
                                  toast.success('Alias copiado al portapapeles');
                                  setTimeout(() => setCopiedField(null), 2000);
                                }}
                                style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px' }}
                              >
                                {copiedField === 'Alias' ? <FiCheck color="green" /> : <FiCopy />} Copiar
                              </button>
                            </div>
                          </div>

                          {bankDetails.notes && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                              💡 {bankDetails.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="transfer-upload" style={{ background: 'var(--color-bg-alt)', padding: 16, borderRadius: 12, border: '1px dashed var(--color-border)' }}>
                      <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <FiUpload style={{ color: 'var(--color-primary)' }} /> Cargar Comprobante de Transferencia (Imagen o PDF)
                      </label>
                      <input type="file" accept="image/*,.pdf" onChange={e => setTransferFile(e.target.files?.[0] || null)} className="form-input" />
                      {transferFile && (
                        <p className="transfer-filename" style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FiCheck /> Comprobante seleccionado: {transferFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Coupon */}
                <div className="coupon-section">
                  <h4><FiTag /> ¿Tenés un cupón de descuento?</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Código de cupón" disabled={!!appliedCoupon} />
                    <button className="btn btn--outline" onClick={handleApplyCoupon} disabled={!!appliedCoupon}>
                      {appliedCoupon ? '✓ Aplicado' : 'Aplicar'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button className="btn btn--ghost" onClick={() => setStep('shipping')}>← Volver</button>
                  <button className="btn btn--primary btn--full" onClick={() => setStep('confirm')}>Revisar pedido</button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
              <div className="checkout-section animate-fade-in">
                <h3><FiCheck /> Confirmar pedido</h3>
                <div className="confirm-items">
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="confirm-item">
                      <img src={product.images[0] || '/placeholder-product.png'} alt={product.name} className="confirm-item__img" />
                      <div className="confirm-item__info">
                        <span>{product.name}</span>
                        <span className="confirm-item__qty">x{quantity}</span>
                      </div>
                      <span className="confirm-item__price">{formatPrice(product.price * quantity)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button className="btn btn--ghost" onClick={() => setStep('payment')}>← Volver</button>
                  <button className="btn btn--primary btn--full btn--lg" onClick={handleSubmit} disabled={processing}>
                    {processing ? <div className="spinner spinner--sm" /> : `Confirmar y pagar ${formatPrice(total)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          <div className="checkout-summary">
            <h3>Resumen</h3>
            <div className="cart-summary__row"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {discount > 0 && <div className="cart-summary__row" style={{ color: 'var(--color-success)' }}><span>Descuento ({appliedCoupon?.code})</span><span>-{formatPrice(discount)}</span></div>}
            <div className="cart-summary__row"><span>Envío</span><span>{shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</span></div>
            <div className="cart-summary__row cart-summary__row--total"><span>Total</span><span>{formatPrice(total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
