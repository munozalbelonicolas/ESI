/**
 * Efectos de aprobar un pedido (stock y cupón), compartidos por las tres vías de aprobación:
 * webhook/verificación de Mercado Pago, aprobación manual de transferencias y pedidos gratuitos.
 * Todas las funciones esperan que las lecturas de la transacción ya se hayan hecho.
 */

import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';

export interface PhysicalLine {
  snap: DocumentSnapshot;
  quantity: number;
}

/** Agrupa por producto las cantidades de los ítems que Firestore marca como físicos. */
export function collectPhysicalProducts(
  items: { productId: string; quantity: number | string }[],
  productSnaps: DocumentSnapshot[]
): Map<string, PhysicalLine> {
  const physical = new Map<string, PhysicalLine>();
  items.forEach((item, index) => {
    const snap = productSnaps[index];
    if (!snap?.exists || snap.data()?.isDigital === true) return;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    const existing = physical.get(snap.id);
    physical.set(snap.id, { snap, quantity: (existing?.quantity || 0) + quantity });
  });
  return physical;
}

/** stock ausente, null o -1 significa "sin control de stock". */
function trackedStock(snap: DocumentSnapshot): number | null {
  const stock = snap.data()?.stock;
  return typeof stock === 'number' && stock !== -1 ? stock : null;
}

/** Productos cuyo stock no alcanza para la cantidad pedida. */
export function findStockShortages(physical: Map<string, PhysicalLine>): { productId: string; name: string; available: number; requested: number }[] {
  const shortages: { productId: string; name: string; available: number; requested: number }[] = [];
  for (const { snap, quantity } of physical.values()) {
    const stock = trackedStock(snap);
    if (stock !== null && stock < quantity) {
      shortages.push({ productId: snap.id, name: String(snap.data()?.name || snap.id), available: Math.max(0, stock), requested: quantity });
    }
  }
  return shortages;
}

export function decrementStock(transaction: Transaction, physical: Map<string, PhysicalLine>): void {
  for (const { snap, quantity } of physical.values()) {
    const stock = trackedStock(snap);
    if (stock === null) continue;
    transaction.update(snap.ref, { stock: Math.max(0, stock - quantity), updatedAt: new Date() });
  }
}

/**
 * Consume el cupón de un pedido que se aprueba.
 * - Reserva vigente: pasa a "consumed".
 * - Reserva ya liberada (pago rechazado y reintentado, o vencida antes de la notificación): se vuelve
 *   a consumir si el cupón todavía tiene cupo, porque el cliente ya pagó con ese descuento.
 * Lanza COUPON_RESERVATION_LOST si falta el cupón y COUPON_CAP_REACHED si ya no hay cupo.
 */
export function consumeCouponOnApproval(
  transaction: Transaction,
  reservationRef: DocumentReference,
  reservationSnap: DocumentSnapshot | null,
  couponSnap: DocumentSnapshot | null
): void {
  if (!reservationSnap?.exists) return;
  const reservation = reservationSnap.data()!;
  if (reservation.status === 'consumed') return;
  if (!couponSnap?.exists) throw new Error('COUPON_RESERVATION_LOST');

  const coupon = couponSnap.data()!;
  const usedCount = Number(coupon.usedCount || 0);
  const reservedCount = Number(coupon.reservedCount || 0);
  const now = new Date();

  if (reservation.status === 'reserved') {
    transaction.update(couponSnap.ref, {
      reservedCount: Math.max(0, reservedCount - 1),
      usedCount: usedCount + 1,
      updatedAt: now,
    });
    transaction.update(reservationRef, { status: 'consumed', updatedAt: now });
    return;
  }

  const maxUses = Number(coupon.maxUses || 0);
  if (maxUses > 0 && usedCount + reservedCount >= maxUses) throw new Error('COUPON_CAP_REACHED');
  transaction.update(couponSnap.ref, { usedCount: usedCount + 1, updatedAt: now });
  transaction.update(reservationRef, { status: 'consumed', reconsumedAt: now, updatedAt: now });
}
