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
import { isValidDocId, readBody } from './_cors.js';
import { sendOrderConfirmationEmail } from './notify-purchase.js';
import { settleCouponReservation } from './_couponReservations.js';
import { collectPhysicalProducts, consumeCouponOnApproval, decrementStock, findStockShortages } from './_fulfillment.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Acceso restringido a administradores' });
    }

    // /api/admin-update-order se reescribe a ?action=update (límite de 12 funciones en Hobby)
    if (req.query?.action === 'update') return updateOrder(req, res, user.uid);

    const { orderId } = readBody(req);
    if (!isValidDocId(orderId)) {
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

      // 1. Stock: el admin decide antes de aprobar, así que un faltante bloquea la aprobación.
      const physicalProducts = collectPhysicalProducts(items, productSnaps);
      const shortages = findStockShortages(physicalProducts);
      if (shortages.length) {
        const error: any = new Error('STOCK_INSUFFICIENT');
        error.shortages = shortages;
        throw error;
      }
      decrementStock(trx, physicalProducts);

      // 2. Cupón: consume la reserva (o la vuelve a consumir si venció y todavía hay cupo).
      if (reservationSnap?.exists) {
        consumeCouponOnApproval(trx, reservationRef, reservationSnap, reservedCouponSnap);
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
    if (error?.message === 'STOCK_INSUFFICIENT') {
      const names = (error.shortages || []).map((s: any) => `${s.name} (hay ${s.available}, pide ${s.requested})`).join(', ');
      return res.status(409).json({ error: `Stock insuficiente: ${names}. Ajustá el stock o cancelá el pedido.` });
    }
    console.error('[AdminApprove] Error aprobando orden:', error?.message || error);
    return res.status(500).json({ error: 'Error al aprobar la orden' });
  }
}

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'rejected', 'refunded'] as const;

/**
 * Cambios de estado hechos por el admin. Pasan por el servidor para que cancelar o rechazar
 * libere la reserva del cupón (antes eran escrituras directas en Firestore que la dejaban tomada).
 * La aprobación tiene su propio flujo (stock, cupón y email) y no se hace por aquí.
 */
async function updateOrder(req: VercelRequest, res: VercelResponse, adminUid: string) {
  const { orderId, status, paymentStatus } = readBody(req);
  if (!isValidDocId(orderId)) return res.status(400).json({ error: 'orderId requerido' });
  if (status !== undefined && !ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) {
    return res.status(400).json({ error: 'Estado de pago inválido' });
  }
  if (status === undefined && paymentStatus === undefined) return res.status(400).json({ error: 'Nada para actualizar' });
  if (status === 'paid') return res.status(400).json({ error: 'Para marcar como pagado usá la aprobación del pedido' });

  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  try {
    await db.runTransaction(async (trx) => {
      const orderSnap = await trx.get(orderRef);
      if (!orderSnap.exists) throw new Error('NOT_FOUND');
      const order = orderSnap.data() || {};
      const approved = order.paymentStatus === 'approved';

      const updates: Record<string, unknown> = { updatedAt: new Date(), lastUpdatedBy: adminUid };
      let releaseCoupon = false;

      if (paymentStatus === 'refunded') {
        if (!approved) throw new Error('REFUND_REQUIRES_APPROVED');
        // Revoca las descargas (exigen 'approved'). En Mercado Pago, el dinero se devuelve desde su panel.
        Object.assign(updates, { paymentStatus: 'refunded', status: 'cancelled', refundedAt: new Date(), refundReason: 'admin' });
      } else if (paymentStatus === 'pending' || paymentStatus === 'rejected') {
        if (approved) throw new Error('APPROVED_LOCKED');
        if (order.paymentStatus === 'refunded') throw new Error('REFUNDED_LOCKED');
        updates.paymentStatus = paymentStatus;
        if (paymentStatus === 'rejected') {
          updates.status = 'cancelled';
          releaseCoupon = true;
        }
      }

      if (status !== undefined && updates.status === undefined) {
        if ((status === 'shipped' || status === 'delivered') && !approved) throw new Error('NOT_PAID');
        if (status === 'pending' && approved) throw new Error('APPROVED_LOCKED');
        if (status !== 'cancelled' && order.paymentStatus === 'refunded') throw new Error('REFUNDED_LOCKED');
        if (status === 'cancelled' && approved) throw new Error('CANCEL_APPROVED');
        updates.status = status;
        if (status === 'cancelled') releaseCoupon = true;
      }

      if (releaseCoupon && order.couponReservationId) {
        const reservationRef = db.collection('couponReservations').doc(String(order.couponReservationId));
        const reservationSnap = await trx.get(reservationRef);
        const couponId = reservationSnap.data()?.couponId;
        const couponSnap = typeof couponId === 'string' ? await trx.get(db.collection('coupons').doc(couponId)) : null;
        if (reservationSnap.exists && couponSnap?.exists) {
          settleCouponReservation(trx, reservationRef, reservationSnap.data()!, couponSnap.ref, couponSnap.data()!, 'released');
        }
      }
      trx.update(orderRef, updates);
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const messages: Record<string, [number, string]> = {
      NOT_FOUND: [404, 'Orden no encontrada'],
      REFUND_REQUIRES_APPROVED: [409, 'Solo se puede marcar como reembolsado un pedido aprobado'],
      APPROVED_LOCKED: [409, 'Un pedido aprobado no vuelve a pendiente ni rechazado; marcalo como reembolsado'],
      REFUNDED_LOCKED: [409, 'El pedido fue reembolsado y ya no admite cambios de estado'],
      NOT_PAID: [409, 'Solo se puede enviar o entregar un pedido con el pago aprobado'],
      CANCEL_APPROVED: [409, 'Para cancelar un pedido pagado, marcá el pago como reembolsado'],
    };
    const known = messages[error?.message];
    if (known) return res.status(known[0]).json({ error: known[1] });
    console.error('[AdminUpdateOrder] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
}
