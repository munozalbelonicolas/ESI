/**
 * Validación de firmas de Webhooks de Mercado Pago.
 * El HMAC lo calcula y compara el validador oficial del SDK (WebhookSignatureValidator), que arma el
 * manifest igual que Mercado Pago: `id:[data.id];request-id:[x-request-id];ts:[ts];`, omitiendo los
 * pares sin valor. Las notificaciones en formato IPN (`?id=...&topic=payment`) no traen `data.id` en la
 * URL, así que se firman sin `id:`; incluirlo igual era lo que producía `signature_mismatch`.
 */

import { InvalidWebhookSignatureError, SignatureFailureReason, WebhookSignatureValidator } from 'mercadopago';

export interface VerifySignatureParams {
  xSignatureHeader?: string | string[];
  xRequestIdHeader?: string | string[];
  /** `data.id` tomado SOLO de la query de la URL (es el valor que firma Mercado Pago). */
  dataId?: string | number;
  secret: string;
  toleranceMs?: number; // por defecto 5 minutos
}

export interface VerifySignatureResult {
  valid: boolean;
  reason?: string;
  ts?: number;
}

const REASONS: Record<SignatureFailureReason, string> = {
  [SignatureFailureReason.MissingSignatureHeader]: 'missing_signature_header',
  [SignatureFailureReason.MalformedSignatureHeader]: 'invalid_signature_format',
  [SignatureFailureReason.MissingTimestamp]: 'invalid_signature_format',
  [SignatureFailureReason.MissingHash]: 'invalid_signature_format',
  [SignatureFailureReason.SignatureMismatch]: 'signature_mismatch',
  [SignatureFailureReason.TimestampOutOfTolerance]: 'timestamp_out_of_tolerance',
};

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Mercado Pago documenta `ts` en segundos, pero también se ha visto en milisegundos: se aceptan ambos. */
function timestampMillis(xSignature: string): number | null {
  const match = /(?:^|,)\s*ts=(\d+)\s*(?:,|$)/.exec(xSignature);
  if (!match) return null;
  const ts = Number(match[1]);
  return ts < 1e11 ? ts * 1000 : ts;
}

export function verifyMpWebhookSignature(params: VerifySignatureParams): VerifySignatureResult {
  const { xSignatureHeader, xRequestIdHeader, dataId, secret, toleranceMs = 5 * 60 * 1000 } = params;
  if (!secret) return { valid: false, reason: 'secret_missing' };

  const xSignature = first(xSignatureHeader);
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId: first(xRequestIdHeader),
      dataId: dataId === undefined || dataId === null ? undefined : String(dataId),
      secret,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      const ts = timestampMillis(xSignature || '') ?? undefined;
      return { valid: false, reason: REASONS[error.reason] || 'signature_invalid', ts };
    }
    throw error;
  }

  // La ventana se controla aquí porque el SDK interpreta `ts` solo como milisegundos.
  const ts = timestampMillis(xSignature!);
  if (ts === null) return { valid: false, reason: 'invalid_timestamp' };
  if (Math.abs(Date.now() - ts) > toleranceMs) return { valid: false, reason: 'timestamp_out_of_tolerance', ts };
  return { valid: true, ts };
}
