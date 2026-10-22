/**
 * Lógica compartida entre mp-webhook y verify-payment.
 * El prefijo "_" evita que Vercel lo exponga como endpoint.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sendOrderConfirmationEmail } from './notify-purchase';

export function ensureAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      initializeApp({ projectId });
    }
  }
}

export function getAdminDb() {
  ensureAdminApp();
  return getFirestore();
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export function mapMpStatus(mpStatus?: string): PaymentStatus {
  if (mpStatus === 'approved') return 'approved';
  if (mpStatus === 'rejected' || mpStatus === 'cancelled') return 'rejected';
  return 'pending';
}

/**
 * Aplica el resultado de un pago de MP a la orden. Es idempotente:
 * stock y email solo se procesan la primera vez que la orden pasa a aprobada.
 * Lanza excepción si Firestore falla (el llamador decide cómo reaccionar).
 */
export async function applyPaymentToOrder(
  orderId: string,
  mpPaymentId: string,
  mpStatus: string | undefined
): Promise<{ found: boolean; paymentStatus: PaymentStatus }> {
  const paymentStatus = mapMpStatus(mpStatus);
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) return { found: false, paymentStatus };

  const orderData = orderSnap.data() || {};
  const alreadyApproved = orderData.paymentStatus === 'approved';

  // Nunca degradar una orden ya aprobada (p. ej. un intento rechazado anterior)
  if (alreadyApproved && paymentStatus !== 'approved') {
    return { found: true, paymentStatus: 'approved' };
  }

  const updates: Record<string, any> = {
    paymentStatus,
    mpPaymentId,
    updatedAt: new Date(),
  };

  if (paymentStatus === 'approved') {
    updates.status = orderData.status === 'shipped' || orderData.status === 'delivered' ? orderData.status : 'paid';

    if (!alreadyApproved) {
      for (const item of orderData.items || []) {
        if (item.isDigital) continue;
        const productRef = db.collection('products').doc(item.productId);
        const productSnap = await productRef.get();
        if (productSnap.exists) {
          const currentStock = productSnap.data()?.stock || 0;
          if (currentStock !== -1) {
            await productRef.update({
              stock: Math.max(0, currentStock - item.quantity),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    if (!orderData.emailSent && orderData.userEmail) {
      try {
        await sendOrderConfirmationEmail({
          orderId,
          userEmail: orderData.userEmail,
          userName: orderData.userName,
          items: orderData.items || [],
          total: orderData.total || 0,
          paymentMethod: 'mercadopago',
          shippingAddress: orderData.shippingAddress || null,
          shippingMethod: orderData.shippingMethod || '',
        });
        updates.emailSent = true;
      } catch (emailErr) {
        console.error(`[OrderSync] Error enviando email para orden #${orderId}:`, emailErr);
      }
    }
  }

  await orderRef.update(updates);
  console.log(`[OrderSync] Orden ${orderId} actualizada: ${paymentStatus}`);
  return { found: true, paymentStatus };
}
