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
import { readBody } from './_cors.js';

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
    const body = readBody(req);
    // Formato webhook (?data.id=...&type=payment) o IPN (?id=...&topic=payment)
    const queryValue = (key: string) => {
      const value = req.query?.[key];
      return Array.isArray(value) ? value[0] : value;
    };
    const urlDataId = queryValue('data.id');
    const type = body.type || queryValue('type') || queryValue('topic');
    // El pago a consultar puede venir en la URL o en el cuerpo; la firma, en cambio, usa solo la URL.
    // En formato IPN la firma no cubre el id, pero no hace falta confiar en él: el pago se vuelve a
    // consultar a la API de Mercado Pago y se valida referencia, moneda y monto antes de aprobar.
    const paymentId = urlDataId || queryValue('id') || body?.data?.id;

    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ ignored: true, reason: 'not_payment_event' });
    }

    // Validación de firma criptográfica oficial
    const sigCheck = verifyMpWebhookSignature({
      xSignatureHeader: req.headers['x-signature'],
      xRequestIdHeader: req.headers['x-request-id'],
      dataId: urlDataId,
      secret: mpWebhookSecret,
      toleranceMs: 5 * 60 * 1000,
    });

    if (!sigCheck.valid) {
      // Diagnóstico sin datos sensibles: formato de la notificación y qué se usó para validar.
      console.error('[Webhook] Firma de webhook de MP rechazada', JSON.stringify({
        reason: sigCheck.reason,
        format: urlDataId ? 'webhook' : queryValue('topic') ? 'ipn' : 'desconocido',
        queryKeys: Object.keys(req.query || {}).sort(),
        bodyKeys: Object.keys(body).sort(),
        bodyDataIdMatchesUrl: body?.data?.id === undefined ? null : String(body.data.id) === String(urlDataId ?? queryValue('id')),
        hasRequestId: Boolean(req.headers['x-request-id']),
        tsDriftSeconds: sigCheck.ts ? Math.round((Date.now() - sigCheck.ts) / 1000) : null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 60),
      }));
      // El motivo queda en el log; responderlo ayudaría a quien intenta falsificar notificaciones.
      return res.status(401).json({ error: 'Firma de webhook inválida o expirada' });
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
