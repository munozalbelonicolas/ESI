import type { Transaction, DocumentReference, Firestore } from 'firebase-admin/firestore';

export const COUPON_RESERVATION_MS = 24 * 60 * 60 * 1000;

export async function reserveCoupon(
  db: Firestore,
  transaction: Transaction,
  orderRef: DocumentReference,
  couponCode: unknown,
  subtotal: unknown,
  paymentMethod: unknown
): Promise<{ couponCode: string | null; reservationId: string | null; couponDiscount: number }> {
  if (typeof couponCode !== 'string' || !couponCode.trim()) {
    return { couponCode: null, reservationId: null, couponDiscount: 0 };
  }
  const normalizedCode = couponCode.trim().toUpperCase();
  const couponQuery = db.collection('coupons').where('code', '==', normalizedCode).limit(1);
  const couponSnap = await transaction.get(couponQuery);
  if (couponSnap.empty) throw new Error('COUPON_INVALID');

  const couponDoc = couponSnap.docs[0];
  const coupon = couponDoc.data();
  const now = Date.now();
  const expiresAt = coupon.expiresAt?.toMillis?.();
  const maxUses = Number(coupon.maxUses || 0);
  const usedCount = Number(coupon.usedCount || 0);
  const reservedCount = Number(coupon.reservedCount || 0);
  const value = Number(coupon.value);
  const couponConfigurationValid =
    (coupon.type === 'percentage' && Number.isFinite(value) && value > 0 && value <= 100) ||
    (coupon.type === 'fixed' && Number.isFinite(value) && value > 0);
  if (
    coupon.isActive !== true ||
    !couponConfigurationValid ||
    !Number.isInteger(maxUses) || maxUses < 0 ||
    !Number.isInteger(usedCount) || usedCount < 0 ||
    !Number.isInteger(reservedCount) || reservedCount < 0 ||
    (Number.isFinite(expiresAt) && expiresAt <= now) ||
    Number(subtotal) < Number(coupon.minPurchase || 0) ||
    (maxUses > 0 && usedCount + reservedCount >= maxUses)
  ) {
    throw new Error('COUPON_UNAVAILABLE');
  }

  const reservationId = orderRef.id;
  const reservationRef = db.collection('couponReservations').doc(reservationId);
  const reservationExpiry = paymentMethod === 'mercadopago'
    ? new Date(now + COUPON_RESERVATION_MS)
    : null;
  transaction.create(reservationRef, {
    orderId: orderRef.id,
    couponId: couponDoc.id,
    couponCode: normalizedCode,
    status: 'reserved',
    paymentMethod,
    expiresAt: reservationExpiry,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  transaction.update(couponDoc.ref, {
    reservedCount: reservedCount + 1,
    updatedAt: new Date(now),
  });
  const couponDiscount = coupon.type === 'percentage'
    ? Math.round((Number(subtotal) * value) / 100)
    : Math.min(value, Number(subtotal));
  return { couponCode: normalizedCode, reservationId, couponDiscount };
}

/** Debe invocarse dentro de una transacción después de leer la reserva y el cupón. */
export function settleCouponReservation(
  transaction: Transaction,
  reservationRef: DocumentReference,
  reservation: FirebaseFirestore.DocumentData,
  couponRef: DocumentReference,
  coupon: FirebaseFirestore.DocumentData,
  outcome: 'consumed' | 'released'
): void {
  if (reservation.status !== 'reserved') return;
  const reservedCount = Math.max(0, Number(coupon.reservedCount || 0) - 1);
  transaction.update(couponRef, {
    reservedCount,
    ...(outcome === 'consumed' ? { usedCount: Number(coupon.usedCount || 0) + 1 } : {}),
    updatedAt: new Date(),
  });
  transaction.update(reservationRef, { status: outcome, updatedAt: new Date() });
}
