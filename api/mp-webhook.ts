/**
 * Vercel Serverless Function — Webhook de Mercado Pago
 * ================================================================
 * Recibe las notificaciones IPN/Webhook de Mercado Pago cuando un pago
 * cambia de estado. Actualiza la orden en Firestore directamente.
 *
 * Plan gratuito: Vercel Hobby = 100 invocaciones/día, suficiente.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment } from 'mercadopago-sdk-node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const mpAccessToken = process.env.MP_ACCESS_TOKEN;

// Inicializar Firebase Admin (con service account o Application Default Credentials)
function getAdminDb() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      // Fallback: si Vercel tiene GOOGLE_APPLICATION_Credentials en env
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // MP envía GET para validar el webhook, hay que responder 200 inmediatamente
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body || {};

    // Solo procesar notificaciones de pago
    if (type !== 'payment' || !data?.id) {
      return res.status(200).json({ ignored: true });
    }

    if (!mpAccessToken) {
      return res.status(200).json({ ignored: 'no MP token' });
    }

    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: String(data.id) });

    if (!payment) {
      return res.status(200).json({ ignored: 'no payment found' });
    }

    const orderId = (payment.metadata as any)?.orderId || '';

    // Mapear estado de MP a nuestro estado
    const mpStatus = payment.status; // approved, pending, rejected, in_process
    let paymentStatus: 'pending' | 'approved' | 'rejected' = 'pending';
    if (mpStatus === 'approved') paymentStatus = 'approved';
    else if (mpStatus === 'rejected' || mpStatus === 'cancelled') paymentStatus = 'rejected';

    // Actualizar la orden en Firestore
    if (orderId) {
      try {
        const db = getAdminDb();
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (orderSnap.exists) {
          const updates: any = {
            paymentStatus,
            mpPaymentId: String(payment.id),
            updatedAt: new Date(),
          };
          if (paymentStatus === 'approved') {
            updates.status = 'paid';
            // Decrementar stock de cada item
            const items = orderSnap.data()?.items || [];
            for (const item of items) {
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
          await orderRef.update(updates);
          console.log(`[Webhook] Orden ${orderId} actualizada: ${paymentStatus}`);
        }
      } catch (dbErr) {
        console.error('[Webhook] Error actualizando Firestore:', dbErr);
      }
    }

    res.status(200).json({ received: true, orderId, paymentStatus });
  } catch (error: any) {
    console.error('[Webhook] Error:', error.message || error);
    // Responder 200 para que MP no reintente infinitamente
    res.status(200).json({ error: 'processed_with_errors' });
  }
}
