import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, isAuthorizedCron } from './_admin.js';
import { settleCouponReservation, TRANSFER_COUPON_RESERVATION_MS } from './_couponReservations.js';

/**
 * Cron diario:
 * 1. Libera reservas de cupón vencidas (Mercado Pago y transferencia).
 *    - Mercado Pago: la preferencia vence junto con la reserva, así que el pedido impago se cancela.
 *    - Transferencia: el pedido queda pendiente (el cliente pudo haber transferido); si el admin lo aprueba
 *      después, el cupón se vuelve a consumir siempre que tenga cupo.
 * 2. Da vencimiento a reservas de transferencia antiguas que se crearon sin él.
 * 3. Borra contadores de rate limit vencidos.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'No autorizado' });

  try {
    const db = getAdminDb();

    const legacy = await db.collection('couponReservations')
      .where('status', '==', 'reserved')
      .where('expiresAt', '==', null)
      .limit(200)
      .get();
    for (const doc of legacy.docs) {
      const createdAt = doc.data().createdAt?.toDate?.() as Date | undefined;
      const base = createdAt instanceof Date ? createdAt.getTime() : Date.now();
      await doc.ref.update({ expiresAt: new Date(base + TRANSFER_COUPON_RESERVATION_MS), updatedAt: new Date() });
    }

    const expired = await db.collection('couponReservations')
      .where('status', '==', 'reserved')
      .where('expiresAt', '<=', new Date())
      .limit(200)
      .get();
    let released = 0;
    for (const candidate of expired.docs) {
      const didRelease = await db.runTransaction(async (transaction) => {
        const reservationSnap = await transaction.get(candidate.ref);
        if (!reservationSnap.exists || reservationSnap.data()?.status !== 'reserved') return false;
        const data = reservationSnap.data()!;
        const expiry = data.expiresAt?.toDate?.();
        if (!(expiry instanceof Date) || expiry.getTime() > Date.now()) return false;
        const orderRef = db.collection('orders').doc(String(data.orderId || candidate.id));
        const orderSnap = await transaction.get(orderRef);
        const couponRef = db.collection('coupons').doc(String(data.couponId || ''));
        const couponSnap = await transaction.get(couponRef);
        if (!couponSnap.exists) return false;
        const order = orderSnap.data();
        // No liberar una orden que ya fue pagada, aunque la notificación llegue tarde.
        if (order?.paymentStatus === 'approved') return false;
        settleCouponReservation(transaction, candidate.ref, data, couponRef, couponSnap.data()!, 'released');
        if (order && order.paymentMethod === 'mercadopago' && (order.paymentStatus === 'pending' || order.paymentStatus === 'rejected')) {
          transaction.update(orderRef, { status: 'cancelled', paymentStatus: 'rejected', updatedAt: new Date() });
        }
        return true;
      });
      if (didRelease) released++;
    }

    const staleLimits = await db.collection('rateLimits').where('expiresAt', '<=', new Date()).limit(400).get();
    if (!staleLimits.empty) {
      const batch = db.batch();
      staleLimits.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return res.status(200).json({ checked: expired.size, released, backfilled: legacy.size, rateLimitsDeleted: staleLimits.size });
  } catch (error: any) {
    console.error('[CouponReservations] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudieron liberar las reservas vencidas' });
  }
}
