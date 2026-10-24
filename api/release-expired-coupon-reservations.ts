import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_admin.ts';
import { settleCouponReservation } from './_couponReservations.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'No autorizado' });

  try {
    const db = getAdminDb();
    const expired = await db.collection('couponReservations')
      .where('status', '==', 'reserved')
      .where('paymentMethod', '==', 'mercadopago')
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
        // No liberar una orden que ya fue pagada, aunque la notificación llegue tarde.
        if (orderSnap.exists && orderSnap.data()?.paymentStatus === 'approved') return false;
        settleCouponReservation(transaction, candidate.ref, data, couponRef, couponSnap.data()!, 'released');
        if (orderSnap.exists && orderSnap.data()?.paymentStatus === 'pending') {
          transaction.update(orderRef, { status: 'cancelled', paymentStatus: 'rejected', updatedAt: new Date() });
        }
        return true;
      });
      if (didRelease) released++;
    }
    return res.status(200).json({ checked: expired.size, released });
  } catch (error: any) {
    console.error('[CouponReservations] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudieron liberar las reservas vencidas' });
  }
}
