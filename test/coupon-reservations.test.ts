import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { reserveCoupon, settleCouponReservation } from '../api/_couponReservations.ts';

const projectId = process.env.GCLOUD_PROJECT || 'demo-esi-local';
if (projectId !== 'demo-esi-local' || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('La prueba de reservas requiere exclusivamente el emulador demo-esi-local.');
}

const testId = `coupon-reservation-${Date.now()}`;
const couponCode = `LIMIT-${Date.now()}`;
const app = getApps()[0] || initializeApp({ projectId }, `coupon-test-${testId}`);
const db = getFirestore(app);
const couponRef = db.collection('coupons').doc(testId);

before(async () => {
  await couponRef.set({
    code: couponCode,
    type: 'percentage',
    value: 10,
    isActive: true,
    maxUses: 1,
    usedCount: 0,
    reservedCount: 0,
    minPurchase: 0,
  });
});

after(async () => {
  const reservations = await db.collection('couponReservations').where('couponId', '==', testId).get();
  const batch = db.batch();
  reservations.docs.forEach((doc) => batch.delete(doc.ref));
  const orders = await db.collection('orders').where('testId', '==', testId).get();
  orders.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(couponRef);
  await batch.commit();
  if (app.name.startsWith('coupon-test-')) await deleteApp(app);
});

it('solo reserva un último uso bajo solicitudes simultáneas y permite reutilizarlo tras liberar', async () => {
  const attempts = await Promise.all(Array.from({ length: 8 }, async () => {
    const orderRef = db.collection('orders').doc();
    try {
      await db.runTransaction(async (transaction) => {
        await reserveCoupon(db, transaction, orderRef, couponCode, 100, 'mercadopago');
        transaction.create(orderRef, { testId, couponReservationId: orderRef.id });
      });
      return orderRef;
    } catch (error: any) {
      if (error?.message === 'COUPON_UNAVAILABLE') return null;
      throw error;
    }
  }));

  const winners = attempts.filter((order): order is NonNullable<typeof order> => order !== null);
  assert.equal(winners.length, 1, 'exactamente un pedido debe reservar el último cupón');
  let coupon = (await couponRef.get()).data();
  assert.equal(coupon?.reservedCount, 1);
  const orderId = winners[0].id;
  const reservationRef = db.collection('couponReservations').doc(orderId);

  await db.runTransaction(async (transaction) => {
    const reservation = await transaction.get(reservationRef);
    const currentCoupon = await transaction.get(couponRef);
    settleCouponReservation(transaction, reservationRef, reservation.data()!, couponRef, currentCoupon.data()!, 'released');
  });
  coupon = (await couponRef.get()).data();
  assert.equal(coupon?.reservedCount, 0);

  const replacement = db.collection('orders').doc();
  await db.runTransaction(async (transaction) => {
    await reserveCoupon(db, transaction, replacement, couponCode, 100, 'transfer');
    transaction.create(replacement, { testId, couponReservationId: replacement.id });
  });
  await db.runTransaction(async (transaction) => {
    const reservationRef = db.collection('couponReservations').doc(replacement.id);
    const reservation = await transaction.get(reservationRef);
    const currentCoupon = await transaction.get(couponRef);
    settleCouponReservation(transaction, reservationRef, reservation.data()!, couponRef, currentCoupon.data()!, 'consumed');
  });
  coupon = (await couponRef.get()).data();
  assert.equal(coupon?.reservedCount, 0);
  assert.equal(coupon?.usedCount, 1);
  await assert.rejects(
    db.runTransaction(async (transaction) => reserveCoupon(db, transaction, db.collection('orders').doc(), couponCode, 100, 'transfer')),
    (error: any) => error?.message === 'COUPON_UNAVAILABLE'
  );
});
