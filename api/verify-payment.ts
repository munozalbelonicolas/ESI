/**
 * Vercel Serverless Function — Verificar pago de una orden contra Mercado Pago
 * ================================================================
 * El cliente (autenticado) pide verificar su orden. Se busca en MP el pago
 * por external_reference y, si está aprobado y coincide con la orden, se actualiza.
 * Sirve cuando el cliente no volvió al sitio o el webhook falló.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { applyPaymentToOrder, getAdminDb, requireUser } from './_orderSync.js';
import { isValidDocId, readBody } from './_cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN;
  if (!mpAccessToken) {
    return res.status(500).json({ error: 'Mercado Pago no configurado' });
  }

  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { orderId } = readBody(req);
    if (!isValidDocId(orderId)) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const orderSnap = await getAdminDb().collection('orders').doc(orderId).get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    const order = orderSnap.data() || {};
    if (order.userId !== user.uid && !user.isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (order.paymentStatus === 'approved') {
      return res.status(200).json({ paymentStatus: 'approved' });
    }

    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const search = await new Payment(mp).search({
      options: { external_reference: orderId, sort: 'date_created', criteria: 'desc' },
    });
    const payments = search.results || [];

    // Priorizar un pago aprobado; si no, el más reciente
    const chosen = payments.find((p) => p.status === 'approved') || payments[0];
    if (!chosen) {
      return res.status(200).json({ paymentStatus: 'pending', found: false });
    }

    const result = await applyPaymentToOrder(orderId, chosen);
    return res.status(200).json({ paymentStatus: result.paymentStatus, found: true });
  } catch (error: any) {
    console.error('[VerifyPayment] Error:', error.message || error);
    return res.status(500).json({ error: 'No se pudo verificar el pago' });
  }
}
