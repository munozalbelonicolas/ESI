/**
 * Vercel Serverless Function — Aprobación autorizada de pedidos por Administrador
 * ==============================================================================
 * Permite al administrador confirmar la acreditación de una transferencia bancaria
 * u orden manual, ejecutando de forma atómica:
 * 1. Actualización de estado a 'paid' y 'approved'.
 * 2. Descuento atómico de stock para productos físicos.
 * 3. Aplicación atómica de usos de cupones (si corresponde).
 * 4. Envío seguro de email de compra con enlaces de descarga de material digital.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireUser } from './_admin.js';
import { sendOrderConfirmationEmail } from './notify-purchase.js';
import { settleCouponReservation } from './_couponReservations.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }

    const { orderId } = req.body || {};
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId requerido' });
    }

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    let orderDataToEmail: any = null;
    let shouldSendEmail = false;

    await db.runTransaction(async (trx) => {
      shouldSendEmail = false;
      const orderSnap = await trx.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const orderData = orderSnap.data() || {};
      orderDataToEmail = { ...orderData, id: orderSnap.id };

      // Mercado Pago orders must be approved only by the verified MP webhook
      // or the authenticated payment lookup, never by the manual transfer flow.
      if (orderData.paymentMethod !== 'transfer') {
        throw new Error('TRANSFER_ONLY');
      }

      if (orderData.paymentStatus === 'approved') {
        if (!orderData.emailSent && orderData.userId) {
          trx.update(orderRef, { emailSent: true, updatedAt: new Date() });
          shouldSendEmail = true;
        }
        return; // Ya aprobada previamente
      }

      if (orderData.paymentStatus !== 'pending' || orderData.status !== 'pending') {
        throw new Error('ORDER_NOT_PENDING');
      }

      const proofSnap = await trx.get(db.collection('transferProofs').doc(orderId));
      const proof = proofSnap.data();
      if (
        !proofSnap.exists ||
        proof?.orderId !== orderId ||
        typeof proof?.imageData !== 'string' ||
        !/^data:image\/(jpeg|png|webp);base64,/.test(proof.imageData) ||
        proof.imageData.length >= 900000
      ) {
        throw new Error('TRANSFER_PROOF_REQUIRED');
      }

      const items = Array.isArray(orderData.items) ? orderData.items : [];
      if (
        items.length === 0 || items.length > 50 ||
        items.some((item) =>
          typeof item.productId !== 'string' || !item.productId ||
          !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50
        )
      ) {
        throw new Error('INVALID_ORDER_ITEMS');
      }
      const productRefs = items.map((item) =>
        db.collection('products').doc(item.productId)
      );
      const productSnaps = await Promise.all(productRefs.map((ref) => trx.get(ref)));
      if (productSnaps.some((snap) => !snap.exists)) {
        throw new Error('ORDER_PRODUCT_NOT_FOUND');
      }

      // All transaction reads happen before writes. Product type comes from
      // Firestore, never from the client-supplied item.isDigital value.
      let couponSnap: FirebaseFirestore.QuerySnapshot | null = null;
      if (orderData.couponCode && !orderData.couponUsageIncremented && !orderData.couponReservationId) {
        const cQuery = db
          .collection('coupons')
          .where('code', '==', String(orderData.couponCode).toUpperCase())
          .limit(1);
        couponSnap = await trx.get(cQuery);
      }
      const reservationRef = db.collection('couponReservations').doc(String(orderData.couponReservationId || orderId));
      const reservationSnap = orderData.couponCode && !orderData.couponUsageIncremented
        ? await trx.get(reservationRef)
        : null;
      let reservedCouponSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (reservationSnap?.exists && typeof reservationSnap.data()?.couponId === 'string') {
        reservedCouponSnap = await trx.get(db.collection('coupons').doc(reservationSnap.data()!.couponId));
      }

      // 1. Descontar stock para los productos que el servidor identifica como físicos.
      const physicalProducts = new Map<string, { snap: FirebaseFirestore.DocumentSnapshot; quantity: number }>();
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const pSnap = productSnaps[index];
        if (!pSnap?.exists || pSnap.data()?.isDigital === true) continue;
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) continue;
        const productId = String(item.productId);
        const existing = physicalProducts.get(productId);
        physicalProducts.set(productId, { snap: pSnap, quantity: (existing?.quantity || 0) + quantity });
      }
      for (const { snap, quantity } of physicalProducts.values()) {
        const currentStock = snap.data()?.stock;
        if (typeof currentStock === 'number' && currentStock !== -1) {
          trx.update(snap.ref, {
            stock: Math.max(0, currentStock - quantity),
            updatedAt: new Date(),
          });
        }
      }

      // 2. Incrementar cupón atómicamente si corresponde.
      if (reservationSnap?.exists && reservationSnap.data()?.status !== 'reserved') {
        throw new Error('COUPON_RESERVATION_LOST');
      }
      if (reservationSnap?.exists && reservationSnap.data()?.status === 'reserved' && reservedCouponSnap?.exists) {
        settleCouponReservation(trx, reservationRef, reservationSnap.data()!, reservedCouponSnap.ref, reservedCouponSnap.data()!, 'consumed');
      } else if (reservationSnap?.exists && !reservedCouponSnap?.exists) {
        throw new Error('COUPON_RESERVATION_LOST');
      } else if (couponSnap && !couponSnap.empty) {
        const coupon = couponSnap.docs[0].data();
        const maxUses = Number(coupon.maxUses || 0);
        if (maxUses > 0 && Number(coupon.usedCount || 0) + Number(coupon.reservedCount || 0) >= maxUses) {
          throw new Error('COUPON_CAP_REACHED');
        }
        trx.update(couponSnap.docs[0].ref, { usedCount: FieldValue.increment(1) });
      }

      shouldSendEmail = !!orderData.userId && !orderData.emailSent;
      // 3. Reservar también el envío para evitar duplicados concurrentes.
      trx.update(orderRef, {
        status: 'paid',
        paymentStatus: 'approved',
        couponUsageIncremented: true,
        ...(shouldSendEmail ? { emailSent: true } : {}),
        approvedBy: user.uid,
        updatedAt: new Date(),
      });
    });

    // 4. Enviar email de confirmación con los enlaces digitales seguros
    if (shouldSendEmail && orderDataToEmail) {
      try {
        await sendOrderConfirmationEmail({
          orderId,
          userId: orderDataToEmail.userId,
          userName: orderDataToEmail.userName,
          items: orderDataToEmail.items || [],
          total: orderDataToEmail.total || 0,
          paymentMethod: orderDataToEmail.paymentMethod || 'transfer',
          paymentStatus: 'approved',
          shippingAddress: orderDataToEmail.shippingAddress || null,
          shippingMethod: orderDataToEmail.shippingMethod || '',
        });
        await orderRef.update({ emailSent: true, updatedAt: new Date() });
      } catch (emailErr) {
        console.error(`[AdminApprove] Error enviando email de confirmación #${orderId}:`, emailErr);
        await orderRef.update({ emailSent: false, updatedAt: new Date() });
      }
    }

    return res.status(200).json({ success: true, orderId });
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (error?.message === 'TRANSFER_ONLY') {
      return res.status(409).json({ error: 'Las órdenes de Mercado Pago deben validarse con Mercado Pago' });
    }
    if (error?.message === 'ORDER_NOT_PENDING') {
      return res.status(409).json({ error: 'La orden ya no está pendiente' });
    }
    if (error?.message === 'TRANSFER_PROOF_REQUIRED') {
      return res.status(409).json({ error: 'La orden no tiene un comprobante de transferencia válido' });
    }
    if (error?.message === 'INVALID_ORDER_ITEMS' || error?.message === 'ORDER_PRODUCT_NOT_FOUND') {
      return res.status(409).json({ error: 'La orden contiene productos o cantidades inválidos' });
    }
    if (error?.message === 'COUPON_RESERVATION_LOST' || error?.message === 'COUPON_CAP_REACHED') {
      return res.status(409).json({ error: 'La reserva del cupón no está disponible. Revisá el pedido antes de aprobarlo.' });
    }
    console.error('[AdminApprove] Error aprobando orden:', error?.message || error);
    return res.status(500).json({ error: 'Error al aprobar la orden' });
  }
}
