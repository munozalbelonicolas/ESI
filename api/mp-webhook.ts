/**
 * Vercel Serverless Function — Webhook de Mercado Pago
 * ================================================================
 * Recibe las notificaciones IPN/Webhook de Mercado Pago cuando un pago
 * cambia de estado.
 * 1. Valida criptográficamente la firma (HMAC-SHA256 con timestamp) según especificación oficial.
 * 2. Consulta el estado real del pago al servidor de Mercado Pago (nunca confía ciegamente en el payload).
 * 3. Aplica los cambios de forma idempotente y atómica en Firestore.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { applyPaymentToOrder } from './_orderSync.js';
import { verifyMpWebhookSignature } from './_mpSignature.js';

const mpAccessToken = process.env.MP_ACCESS_TOKEN;
const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // MP envía GET para comprobar conectividad del endpoint
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fail closed: never accept or process a payment notification without the
  // configured Mercado Pago signing secret.
  if (!mpWebhookSecret) {
    console.error('[Webhook] MP_WEBHOOK_SECRET no está configurada');
    return res.status(503).json({ error: 'Webhook signature validation is not configured' });
  }

  try {
    const body = req.body || {};
    // Formato webhook (body.type/data.id) o IPN (query topic/id)
    const type = body.type || req.query?.type || req.query?.topic;
    const paymentId = body?.data?.id || req.query?.['data.id'] || req.query?.id;

    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ ignored: true, reason: 'not_payment_event' });
    }

    // Validación de firma criptográfica oficial
    const sigCheck = verifyMpWebhookSignature({
      xSignatureHeader: req.headers['x-signature'],
      xRequestIdHeader: req.headers['x-request-id'],
      dataId: String(paymentId),
      secret: mpWebhookSecret,
      toleranceMs: 5 * 60 * 1000,
    });

    if (!sigCheck.valid) {
      console.error(`[Webhook] Firma de webhook de MP rechazada: ${sigCheck.reason}`);
      return res.status(401).json({ error: 'Firma de webhook inválida o expirada', reason: sigCheck.reason });
    }

    if (!mpAccessToken) {
      console.error('[Webhook] MP_ACCESS_TOKEN no configurado');
      return res.status(500).json({ error: 'no MP token' });
    }

    // Consulta de la verdad absoluta al servidor de Mercado Pago
    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const payment = await new Payment(mp).get({ id: String(paymentId) });

    if (!payment) {
      return res.status(200).json({ ignored: 'no payment found' });
    }

    const orderId = payment.external_reference || (payment.metadata as any)?.orderId || '';
    if (!orderId) {
      console.warn(`[Webhook] Pago ${paymentId} recibido sin external_reference ni orderId en metadata`);
      return res.status(200).json({ ignored: 'no orderId' });
    }

    const result = await applyPaymentToOrder(orderId, payment);
    return res.status(200).json({ received: true, orderId, ...result });
  } catch (error: any) {
    // 500 => Mercado Pago reintentará la notificación
    console.error('[Webhook] Error procesando notificación:', error.message || error);
    return res.status(500).json({ error: 'processing_failed' });
  }
}
