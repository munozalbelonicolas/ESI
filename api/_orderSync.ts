/**
 * Lógica compartida entre mp-webhook y verify-payment.
 * El prefijo "_" evita que Vercel lo exponga como endpoint.
 */

import { getAdminDb } from './_admin.js';
import { sendOrderConfirmationEmail } from './notify-purchase.js';
import { calculateOrderShippingCost, isValidShippingZipCode } from './_shipping.js';
import { settleCouponReservation } from './_couponReservations.js';

export { ensureAdminApp, getAdminDb, requireUser } from './_admin.js';

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export function mapMpStatus(mpStatus?: string): PaymentStatus {
  if (mpStatus === 'approved') return 'approved';
  if (mpStatus === 'rejected' || mpStatus === 'cancelled') return 'rejected';
  return 'pending';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Datos mínimos del pago de MP que se validan contra la orden. */
export interface MpPaymentLike {
  id?: string | number;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
}

/**
 * Recalcula el total canónico en el servidor para órdenes heredadas (legacy)
 * que no posean el campo `expectedTotal` previamente grabado.
 * Si no se puede verificar determinísticamente, retorna null.
 */
async function recalculateLegacyCanonicalTotal(
  db: FirebaseFirestore.Firestore,
  orderData: any
): Promise<number | null> {
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  if (items.length === 0) return null;

  let subtotal = 0;
  let totalWeightGrams = 0;
  let allDigital = true;

  for (const it of items) {
    const qty = Number(it.quantity);
    if (!it.productId || !Number.isInteger(qty) || qty < 1) return null;
    const pSnap = await db.collection('products').doc(String(it.productId)).get();
    if (!pSnap.exists) return null;
    const p = pSnap.data();
    if (!p) return null;
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    subtotal += price * qty;

    const isDigital = !!p.isDigital;
    if (!isDigital) {
      allDigital = false;
      const w = Number(p.weightGrams);
      totalWeightGrams += (Number.isFinite(w) && w > 0 ? w : 300) * qty;
    }
  }

  let discountAmount = 0;
  if (orderData.couponCode && typeof orderData.couponCode === 'string') {
    const cSnap = await db
      .collection('coupons')
      .where('code', '==', orderData.couponCode.toUpperCase())
      .limit(1)
      .get();
    if (!cSnap.empty) {
      const c = cSnap.docs[0].data();
      discountAmount =
        c.type === 'percentage'
          ? Math.round((subtotal * Number(c.value || 0)) / 100)
          : Math.min(Number(c.value || 0), subtotal);
      discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
    }
  }

  let shipping = 0;
  if (!allDigital) {
    const zip = orderData.shippingAddress?.zipCode;
    if (!zip || !isValidShippingZipCode(String(zip))) {
      return null;
    }
    try {
      shipping = await calculateOrderShippingCost({
        zipCode: String(zip),
        weightGrams: Math.max(totalWeightGrams, 300),
        shippingMethod: orderData.shippingMethod || '',
        subtotal,
      });
    } catch {
      return null;
    }
  }

  return round2(subtotal - discountAmount + shipping);
}

/**
 * Aplica el resultado de un pago de MP a la orden con máxima seguridad e idempotencia.
 * - Exige referencia externa idéntica a la orden y moneda ARS.
 * - Compara contra el total canónico del servidor (nunca confía en order.total del cliente).
 * - Reserva de forma atómica el mpPaymentId en la colección `mpPayments` dentro de una transacción.
 * - Descuenta stock e incrementa contador de cupones atómicamente.
 */
export async function applyPaymentToOrder(
  orderId: string,
  payment: MpPaymentLike
): Promise<{ found: boolean; paymentStatus: PaymentStatus; mismatch?: boolean }> {
  const mpPaymentId = String(payment.id || '');
  if (!mpPaymentId) {
    throw new Error('payment.id requerido para sincronizar');
  }

  const paymentStatus = mapMpStatus(payment.status);
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) return { found: false, paymentStatus };

  const orderData = orderSnap.data() || {};
  const alreadyApproved = orderData.paymentStatus === 'approved';

  // Nunca degradar una orden ya aprobada
  if (alreadyApproved && paymentStatus !== 'approved') {
    return { found: true, paymentStatus: 'approved' };
  }
  if (alreadyApproved && paymentStatus === 'approved') {
    return { found: true, paymentStatus: 'approved' };
  }

  if (paymentStatus === 'approved' && !alreadyApproved) {
    const problems: string[] = [];

    // 1. Exigir referencia exacta de orden
    if (!payment.external_reference || String(payment.external_reference) !== orderId) {
      problems.push(`referencia externa faltante o no coincide (recibido: ${payment.external_reference || 'ninguna'}, esperado: ${orderId})`);
    }

    // 2. Exigir moneda ARS
    if (!payment.currency_id || payment.currency_id !== 'ARS') {
      problems.push(`moneda faltante o no es ARS (recibido: ${payment.currency_id || 'ninguna'})`);
    }

    // 3. Obtener o recalcular total canónico en servidor (nunca usar order.total del cliente)
    let expectedTotal: number | null = null;
    if (orderData.expectedTotal !== undefined && orderData.expectedTotal !== null) {
      const parsed = Number(orderData.expectedTotal);
      if (Number.isFinite(parsed) && parsed > 0) {
        expectedTotal = round2(parsed);
      }
    }

    if (expectedTotal === null) {
      // Orden legacy previa a la implementación de expectedTotal: calcular canónicamente
      console.warn(`[OrderSync] Orden ${orderId} no tiene expectedTotal. Recalculando en servidor...`);
      expectedTotal = await recalculateLegacyCanonicalTotal(db, orderData);
      if (expectedTotal === null) {
        problems.push('orden_antigua_requiere_revision_manual_sin_total_verificable');
      }
    }

    // 4. Exigir monto finito y comparación exacta
    const paid = Number(payment.transaction_amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      problems.push(`monto pagado inválido o no finito (${paid})`);
    } else if (expectedTotal !== null && Math.abs(round2(paid) - expectedTotal) > 0.01) {
      problems.push(`monto pagado no coincide con el canónico (pagado ${round2(paid)}, esperado ${expectedTotal})`);
    }

    // Si hubo problemas de validación de negocio, marcar mismatch y no aprobar
    if (problems.length > 0) {
      console.error(`[OrderSync] Pago ${mpPaymentId} NO aprobado para orden ${orderId}: ${problems.join('; ')}`);
      await orderRef.update({
        paymentMismatch: problems.join('; '),
        mpPaymentId,
        updatedAt: new Date(),
      });
      return { found: true, paymentStatus: 'pending', mismatch: true };
    }

    // 5. Reserva idempotente y atómica en Firestore Transaction
    const mpPaymentRef = db.collection('mpPayments').doc(mpPaymentId);
    let couponRef: FirebaseFirestore.DocumentReference | null = null;
    if (orderData.couponCode && !orderData.couponReservationId) {
      const cSnap = await db
        .collection('coupons')
        .where('code', '==', String(orderData.couponCode).toUpperCase())
        .limit(1)
        .get();
      if (!cSnap.empty) {
        couponRef = cSnap.docs[0].ref;
      }
    }

    const items = Array.isArray(orderData.items) ? orderData.items : [];
    if (items.length === 0 || items.some((it) =>
      typeof it.productId !== 'string' || !it.productId ||
      !Number.isInteger(Number(it.quantity)) || Number(it.quantity) < 1 || Number(it.quantity) > 50
    )) {
      await orderRef.update({ paymentMismatch: 'orden_con_items_invalidos', updatedAt: new Date() });
      return { found: true, paymentStatus: 'pending', mismatch: true };
    }
    let shouldSendEmail = false;

    try {
      await db.runTransaction(async (transaction) => {
        shouldSendEmail = false;
        // --- LECTURAS (Transaction reads must happen before writes) ---
        const paymentDoc = await transaction.get(mpPaymentRef);
        if (paymentDoc.exists) {
          const claimedBy = paymentDoc.data()?.orderId;
          if (claimedBy && claimedBy !== orderId) {
            throw new Error(`PAYMENT_ALREADY_CLAIMED_BY_${claimedBy}`);
          }
        }

        const freshOrderDoc = await transaction.get(orderRef);
        if (!freshOrderDoc.exists) throw new Error('ORDER_NOT_FOUND');
        if (freshOrderDoc.data()?.paymentStatus === 'approved') {
          return; // Ya aprobada de forma concurrente
        }

        const productSnaps = await Promise.all(
          items.map((it) => transaction.get(db.collection('products').doc(String(it.productId || ''))))
        );
        const physicalProducts = new Map<string, { snap: FirebaseFirestore.DocumentSnapshot; quantity: number }>();
        items.forEach((item, index) => {
          const snap = productSnaps[index];
          const productId = String(item.productId);
          if (!snap?.exists || snap.data()?.isDigital === true) return;
          const existing = physicalProducts.get(productId);
          physicalProducts.set(productId, {
            snap,
            quantity: (existing?.quantity || 0) + Number(item.quantity),
          });
        });

        const reservationRef = db.collection('couponReservations').doc(String(orderData.couponReservationId || orderId));
        const reservationSnap = orderData.couponCode ? await transaction.get(reservationRef) : null;
        let couponSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        if (reservationSnap?.exists && typeof reservationSnap.data()?.couponId === 'string') {
          couponSnap = await transaction.get(db.collection('coupons').doc(reservationSnap.data()!.couponId));
        } else if (couponRef) {
          couponSnap = await transaction.get(couponRef);
        }

        // --- ESCRITURAS ---
        // A. Reservar pago
        transaction.set(
          mpPaymentRef,
          {
            orderId,
            paymentId: mpPaymentId,
            amount: paid,
            currency: 'ARS',
            status: 'approved',
            createdAt: new Date(),
          },
          { merge: true }
        );

        // B. Actualizar orden
        const nextStatus =
          orderData.status === 'shipped' || orderData.status === 'delivered' ? orderData.status : 'paid';

        transaction.update(orderRef, {
          paymentStatus: 'approved',
          status: nextStatus,
          mpPaymentId,
          expectedTotal,
          ...(orderData.userId && !orderData.emailSent ? { emailSent: true } : {}),
          paymentMismatch: null,
          updatedAt: new Date(),
        });
        shouldSendEmail = !!orderData.userId && !orderData.emailSent;

        // C. Descontar stock
        for (const { snap, quantity } of physicalProducts.values()) {
          const currentStock = snap.data()?.stock;
          if (currentStock !== undefined && currentStock !== null && currentStock !== -1) {
            transaction.update(snap.ref, {
              stock: Math.max(0, Number(currentStock) - quantity),
              updatedAt: new Date(),
            });
          }
        }

        // D. Incrementar cupón si aplica
        if (reservationSnap?.exists && reservationSnap.data()?.status !== 'reserved') {
          throw new Error('COUPON_RESERVATION_LOST');
        }
        if (reservationSnap?.exists && reservationSnap.data()?.status === 'reserved' && couponSnap?.exists) {
          settleCouponReservation(transaction, reservationRef, reservationSnap.data()!, couponSnap.ref, couponSnap.data()!, 'consumed');
        } else if (reservationSnap?.exists && !couponSnap?.exists) {
          throw new Error('COUPON_RESERVATION_LOST');
        } else if (couponSnap && couponSnap.exists && !reservationSnap?.exists) {
          const cData = couponSnap.data() || {};
          const currentCount = Number(cData.usedCount || 0);
          const maxUses = Number(cData.maxUses || 0);
          if (maxUses > 0 && currentCount + Number(cData.reservedCount || 0) >= maxUses) {
            throw new Error('COUPON_CAP_REACHED');
          }
          transaction.update(couponSnap.ref, {
            usedCount: currentCount + 1,
            updatedAt: new Date(),
          });
        }
      });
    } catch (txErr: any) {
      if (txErr?.message?.startsWith('PAYMENT_ALREADY_CLAIMED')) {
        console.error(`[OrderSync] Conflicto de pago: ${txErr.message}`);
        await orderRef.update({
          paymentMismatch: 'Este pago ya fue utilizado en otra orden',
          updatedAt: new Date(),
        });
        return { found: true, paymentStatus: 'pending', mismatch: true };
      }
      if (txErr?.message === 'COUPON_RESERVATION_LOST' || txErr?.message === 'COUPON_CAP_REACHED') {
        await orderRef.update({ paymentMismatch: 'reserva_de_cupon_no_disponible_requiere_revision_manual', mpPaymentId, updatedAt: new Date() });
        return { found: true, paymentStatus: 'pending', mismatch: true };
      }
      throw txErr;
    }

    // Enviar confirmación por correo si no se envió aún
    if (shouldSendEmail) {
      try {
        await sendOrderConfirmationEmail({
          orderId,
          userId: orderData.userId,
          userName: orderData.userName,
          items: orderData.items || [],
          total: expectedTotal || orderData.total || 0,
          paymentMethod: 'mercadopago',
          paymentStatus: 'approved',
          shippingAddress: orderData.shippingAddress || null,
          shippingMethod: orderData.shippingMethod || '',
        });
        await orderRef.update({ emailSent: true });
      } catch (emailErr) {
        console.error(`[OrderSync] Error enviando email para orden #${orderId}:`, emailErr);
        await orderRef.update({ emailSent: false, updatedAt: new Date() });
      }
    }

    console.log(`[OrderSync] Orden ${orderId} aprobada exitosamente con pago ${mpPaymentId}`);
    return { found: true, paymentStatus: 'approved' };
  }

  // Recheck approval inside the transaction: a delayed pending/rejected event
  // must never overwrite a concurrent approved payment.
  const finalStatus = await db.runTransaction(async (transaction): Promise<PaymentStatus> => {
      const freshOrder = await transaction.get(orderRef);
      if (!freshOrder.exists) throw new Error('ORDER_NOT_FOUND');
      const fresh = freshOrder.data()!;
      if (fresh.paymentStatus === 'approved') return 'approved';
      if (paymentStatus !== 'rejected' || !fresh.couponCode) {
        transaction.update(orderRef, { paymentStatus, mpPaymentId, updatedAt: new Date() });
        return paymentStatus;
      }
      const reservationRef = db.collection('couponReservations').doc(String(fresh.couponReservationId || orderId));
      const reservationSnap = await transaction.get(reservationRef);
      let couponSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (reservationSnap.exists && typeof reservationSnap.data()?.couponId === 'string') {
        couponSnap = await transaction.get(db.collection('coupons').doc(reservationSnap.data()!.couponId));
      }
      if (reservationSnap.exists && couponSnap?.exists && reservationSnap.data()?.status === 'reserved') {
        settleCouponReservation(transaction, reservationRef, reservationSnap.data()!, couponSnap.ref, couponSnap.data()!, 'released');
      }
      transaction.update(orderRef, { paymentStatus, mpPaymentId, updatedAt: new Date() });
      return paymentStatus;
  });
  console.log(`[OrderSync] Orden ${orderId} actualizada: ${finalStatus}`);
  return { found: true, paymentStatus: finalStatus };
}
