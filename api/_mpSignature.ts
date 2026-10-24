/**
 * Validación criptográfica de firmas de Webhooks de Mercado Pago.
 * Implementa la especificación oficial HMAC-SHA256 con tolerancia temporal.
 */

import crypto from 'crypto';

export interface VerifySignatureParams {
  xSignatureHeader?: string | string[];
  xRequestIdHeader?: string | string[];
  dataId?: string | number;
  secret: string;
  toleranceMs?: number; // por defecto 5 minutos
}

export interface VerifySignatureResult {
  valid: boolean;
  reason?: string;
  ts?: number;
}

/**
 * Valida la firma del header `x-signature` (`ts=...,v1=...`) y `x-request-id` de Mercado Pago.
 * Plantilla oficial: `id:${dataId};request-id:${xRequestId};ts:${ts};`
 */
export function verifyMpWebhookSignature(params: VerifySignatureParams): VerifySignatureResult {
  const {
    xSignatureHeader,
    xRequestIdHeader,
    dataId,
    secret,
    toleranceMs = 5 * 60 * 1000,
  } = params;

  if (!secret) {
    return { valid: false, reason: 'secret_missing' };
  }

  const sigRaw = Array.isArray(xSignatureHeader) ? xSignatureHeader[0] : xSignatureHeader;
  const requestId = Array.isArray(xRequestIdHeader) ? xRequestIdHeader[0] : xRequestIdHeader;

  if (!sigRaw || !requestId || !dataId) {
    return { valid: false, reason: 'missing_signature_headers_or_id' };
  }

  // Extraer ts y v1
  let tsStr = '';
  let v1Hash = '';

  const parts = sigRaw.split(/[,;]/);
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    const val = rest.join('=');
    if (key === 'ts') tsStr = val;
    if (key === 'v1') v1Hash = val;
  }

  if (!tsStr || !v1Hash) {
    return { valid: false, reason: 'invalid_signature_format' };
  }

  const tsNum = Number(tsStr);
  if (!Number.isFinite(tsNum)) {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  // Mercado Pago puede enviar ts en segundos o milisegundos
  const tsMillis = tsNum < 1e11 ? tsNum * 1000 : tsNum;
  const now = Date.now();

  if (Math.abs(now - tsMillis) > toleranceMs) {
    return { valid: false, reason: 'timestamp_out_of_tolerance', ts: tsMillis };
  }

  // Construir manifest oficial: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
  const manifest = `id:${String(dataId)};request-id:${requestId};ts:${tsStr};`;
  const computedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // Comparación en tiempo constante para mitigar timing attacks
  try {
    const receivedBuffer = Buffer.from(v1Hash.toLowerCase(), 'hex');
    const computedBuffer = Buffer.from(computedHash.toLowerCase(), 'hex');

    if (receivedBuffer.length !== computedBuffer.length) {
      return { valid: false, reason: 'signature_length_mismatch', ts: tsMillis };
    }

    const matches = crypto.timingSafeEqual(receivedBuffer, computedBuffer);
    if (!matches) {
      return { valid: false, reason: 'signature_mismatch', ts: tsMillis };
    }

    return { valid: true, ts: tsMillis };
  } catch (err: any) {
    return { valid: false, reason: `crypto_error: ${err?.message || err}`, ts: tsMillis };
  }
}
