/**
 * Vercel Serverless Function — Webhook de Mercado Pago
 * ================================================================
 * Recibe las notificaciones IPN/Webhook de Mercado Pago cuando un pago
 * cambia de estado. Actualiza la orden en Firestore directamente.
 * Si falla la escritura en Firestore responde 500 para que MP reintente.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { applyPaymentToOrder } from './_orderSync';

const mpAccessToken = process.env.MP_ACCESS_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // MP envía GET para validar el webhook, hay que responder 200 inmediatamente
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    // Formato webhook (body.type/data.id) o IPN (query topic/id)
    const type = body.type || req.query?.type || req.query?.topic;
    const paymentId = body?.data?.id || req.query?.['data.id'] || req.query?.id;

    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ ignored: true });
    }

    if (!mpAccessToken) {
      console.error('[Webhook] MP_ACCESS_TOKEN no configurado');
      return res.status(500).json({ error: 'no MP token' });
    }

    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const payment = await new Payment(mp).get({ id: String(paymentId) });

    if (!payment) {
      return res.status(200).json({ ignored: 'no payment found' });
    }

    const orderId = payment.external_reference || (payment.metadata as any)?.orderId || '';
    if (!orderId) {
      return res.status(200).json({ ignored: 'no orderId' });
    }

    const result = await applyPaymentToOrder(orderId, String(payment.id), payment.status);
    return res.status(200).json({ received: true, orderId, ...result });
  } catch (error: any) {
    // 500 => Mercado Pago reintenta la notificación más tarde
    console.error('[Webhook] Error:', error.message || error);
    return res.status(500).json({ error: 'processing_failed' });
  }
}
