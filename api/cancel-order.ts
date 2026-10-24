import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, requireUser } from './_admin.ts';
import { settleCouponReservation } from './_couponReservations.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    const orderId = req.body?.orderId;
    if (typeof orderId !== 'string' || !orderId) return res.status(400).json({ error: 'orderId requerido' });

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);
    await db.runTransaction(async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists || orderSnap.data()?.userId !== user.uid) throw new Error('ORDER_NOT_FOUND');
      const order = orderSnap.data() || {};
      if (order.paymentStatus !== 'pending' || order.status !== 'pending') throw new Error('ORDER_NOT_PENDING');
      // No liberar el cupo mientras exista una preferencia de pago aún utilizable.
      if (order.paymentMethod === 'mercadopago' && order.mpPreferenceId) throw new Error('MP_PAYMENT_ACTIVE');

      const reservationId = order.couponReservationId;
      let reservationSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let couponSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (typeof reservationId === 'string') {
        const reservationRef = db.collection('couponReservations').doc(reservationId);
        reservationSnap = await transaction.get(reservationRef);
        const couponId = reservationSnap.data()?.couponId;
        if (reservationSnap.exists && typeof couponId === 'string') {
          couponSnap = await transaction.get(db.collection('coupons').doc(couponId));
        }
      }
      if (reservationSnap?.exists && couponSnap?.exists && reservationSnap.data()?.status === 'reserved') {
        settleCouponReservation(transaction, reservationSnap.ref, reservationSnap.data()!, couponSnap.ref, couponSnap.data()!, 'released');
      }
      transaction.update(orderRef, { status: 'cancelled', paymentStatus: 'rejected', updatedAt: new Date() });
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Pedido no encontrado' });
    if (error?.message === 'ORDER_NOT_PENDING') return res.status(409).json({ error: 'El pedido ya no está pendiente' });
    if (error?.message === 'MP_PAYMENT_ACTIVE') return res.status(409).json({ error: 'El pago de Mercado Pago sigue activo y no se puede cancelar desde aquí' });
    console.error('[CancelOrder] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo cancelar el pedido' });
  }
}
