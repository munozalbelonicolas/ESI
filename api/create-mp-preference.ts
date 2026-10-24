/**
 * Vercel Serverless Function — Crear preferencia de Mercado Pago
 * ================================================================
 * Recibe SOLO el orderId. Valida sesión y titularidad, y construye ítems,
 * descuento, envío y total a partir de datos confiables de Firestore
 * (nunca de precios enviados por el navegador). Guarda el total esperado
 * (expectedTotal) en la orden para validar luego el pago.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminDb, requireUser } from './_orderSync.js';
import { calculateOrderShippingCost, isValidShippingZipCode } from './_shipping.js';

const MAX_QTY = 50;

function allowedOrigins(): string[] {
  const site = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return [site, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN;
  if (!mpAccessToken) {
    console.error('[MP] MP_ACCESS_TOKEN no configurado');
    return res.status(500).json({ error: 'Mercado Pago no configurado' });
  }

  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { orderId } = req.body || {};
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId requerido' });
    }

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: 'Orden no encontrada' });

    const order = orderSnap.data() || {};
    if (order.userId !== user.uid) return res.status(403).json({ error: 'No autorizado' });
    if (order.paymentMethod !== 'mercadopago') return res.status(400).json({ error: 'La orden no es de Mercado Pago' });
    if (order.paymentStatus === 'approved' || order.status === 'cancelled') {
      return res.status(409).json({ error: 'La orden ya no admite pago' });
    }

    let couponReservationExpiry: Date | null = null;
    if (order.couponCode) {
      const reservationId = String(order.couponReservationId || orderId);
      const reservationSnap = await db.collection('couponReservations').doc(reservationId).get();
      const reservation = reservationSnap.data();
      const expiry = reservation?.expiresAt?.toDate?.();
      if (!reservationSnap.exists || reservation?.status !== 'reserved' || !(expiry instanceof Date) || expiry.getTime() <= Date.now()) {
        return res.status(409).json({ error: 'La reserva del cupón venció. Volvé al carrito para crear un pedido nuevo.' });
      }
      couponReservationExpiry = expiry;
    }

    const orderItems: any[] = Array.isArray(order.items) ? order.items : [];
    if (orderItems.length === 0 || orderItems.length > 50) {
      return res.status(400).json({ error: 'Orden sin ítems válidos' });
    }

    // Precios, nombres y tipo (digital/físico) desde Firestore
    let subtotal = 0;
    let totalWeightGrams = 0;
    const lines: { id: string; title: string; quantity: number; price: number; picture?: string; isDigital: boolean }[] = [];
    for (const it of orderItems) {
      const qty = Number(it.quantity);
      if (!it.productId || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return res.status(400).json({ error: 'Cantidad o producto inválido' });
      }
      const pSnap = await db.collection('products').doc(String(it.productId)).get();
      const p = pSnap.data();
      if (!pSnap.exists || !p || p.isActive === false) {
        return res.status(400).json({ error: 'Un producto ya no está disponible' });
      }
      const price = Number(p.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: 'Producto con precio inválido' });
      }
      const isDigital = !!p.isDigital;
      if (!isDigital) {
        const itemWeight = Number(p.weightGrams);
        totalWeightGrams += (Number.isFinite(itemWeight) && itemWeight > 0 ? itemWeight : 300) * qty;
      }
      const img = Array.isArray(p.images) ? p.images.find((u: any) => typeof u === 'string' && /^https:\/\//.test(u)) : undefined;
      lines.push({
        id: pSnap.id,
        title: String(p.name || 'Producto').slice(0, 256),
        quantity: qty,
        price,
        picture: img,
        isDigital,
      });
      subtotal += price * qty;
    }

    // Cupón: se revalida exclusivamente en servidor contra el documento de Firestore
    let discountAmount = 0;
    if (order.couponCode && typeof order.couponCode === 'string') {
      const cSnap = await db
        .collection('coupons')
        .where('code', '==', order.couponCode.toUpperCase())
        .where('isActive', '==', true)
        .limit(1)
        .get();
      if (!cSnap.empty) {
        const c = cSnap.docs[0].data();
        const expired = c.expiresAt && typeof c.expiresAt.toMillis === 'function' && c.expiresAt.toMillis() < Date.now();
        const exhausted = Number(c.maxUses) > 0 && Number(c.usedCount || 0) + Number(c.reservedCount || 0) > Number(c.maxUses);
        const belowMin = subtotal < Number(c.minPurchase || 0);
        if (!expired && !exhausted && !belowMin) {
          discountAmount =
            c.type === 'percentage'
              ? Math.round((subtotal * Number(c.value)) / 100)
              : Math.min(Number(c.value), subtotal);
          discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
        }
      }
    }
    const discountFactor = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

    // Cálculo canónico del envío en el servidor (nunca confiar en order.shippingCost del cliente)
    const allDigital = lines.every((l) => l.isDigital);
    let shipping = 0;
    if (!allDigital) {
      const zipCode = order.shippingAddress?.zipCode;
      if (!zipCode || !isValidShippingZipCode(String(zipCode))) {
        return res.status(400).json({ error: 'Código postal de envío requerido y debe ser de 4 dígitos' });
      }
      try {
        shipping = await calculateOrderShippingCost({
          zipCode: String(zipCode),
          weightGrams: Math.max(totalWeightGrams, 300),
          shippingMethod: order.shippingMethod || '',
          subtotal,
        });
      } catch (err: any) {
        console.error('[MP] Error calculando costo de envío en servidor:', err?.message || err);
        return res.status(400).json({ error: 'No se pudo calcular el envío de forma confiable' });
      }
    }

    const mpItems: any[] = lines.map((l) => ({
      id: l.id,
      title: l.title,
      quantity: l.quantity,
      unit_price: Math.max(0.01, Math.round(l.price * discountFactor * 100) / 100),
      currency_id: 'ARS',
      ...(l.picture ? { picture_url: l.picture } : {}),
    }));
    if (shipping > 0) {
      mpItems.push({ id: 'shipping', title: 'Envío', quantity: 1, unit_price: shipping, currency_id: 'ARS' });
    }

    const expectedTotal =
      Math.round(mpItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0) * 100) / 100;

    const rawSiteUrl = process.env.VITE_SITE_URL || '';
    const isLocalhost = !rawSiteUrl || rawSiteUrl.includes('localhost') || rawSiteUrl.includes('127.0.0.1');
    const baseUrl = isLocalhost ? 'http://localhost:5173' : rawSiteUrl.replace(/\/$/, '');

    const preferenceData: any = {
      items: mpItems,
      payer: { email: user.email || order.userEmail || undefined },
      external_reference: orderId,
      metadata: { orderId },
      back_urls: {
        success: `${baseUrl}/checkout/exito?order=${orderId}`,
        failure: `${baseUrl}/carrito`,
        pending: `${baseUrl}/mis-ordenes`,
      },
      auto_return: 'approved',
      statement_descriptor: 'ESI Secundaria',
    };
    if (couponReservationExpiry) {
      preferenceData.expires = true;
      preferenceData.expiration_date_from = new Date().toISOString();
      preferenceData.expiration_date_to = couponReservationExpiry.toISOString();
    }
    if (!isLocalhost) {
      preferenceData.notification_url = `${baseUrl}/api/mp-webhook`;
    }

    const result = await new Preference(new MercadoPagoConfig({ accessToken: mpAccessToken })).create({
      body: preferenceData,
    });

    // Total y desglose canónicos: solo el servidor los escribe con valores verificados
    await orderRef.update({
      subtotal,
      discount: discountAmount,
      shippingCost: shipping,
      expectedTotal,
      total: expectedTotal,
      mpPreferenceId: result.id,
      updatedAt: new Date(),
    });

    return res.status(200).json({
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    });
  } catch (error: any) {
    console.error('[MP] Error creando preferencia:', error.message || error);
    return res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
}
