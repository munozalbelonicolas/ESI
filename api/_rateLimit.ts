/**
 * Límite de solicitudes por ventana fija, guardado en Firestore (rateLimits/*, sin acceso desde el cliente).
 * La clave se guarda hasheada para no persistir IPs ni UIDs en claro.
 */

import { createHash } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { getAdminDb } from './_admin.js';

export async function consumeRateLimit(bucket: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  const db = getAdminDb();
  const id = `${bucket}_${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
  const ref = db.collection('rateLimits').doc(id);
  return db.runTransaction(async (transaction) => {
    const now = Date.now();
    const current = (await transaction.get(ref)).data() || {};
    const windowStart = Number(current.windowStart || 0);
    const inWindow = now - windowStart < windowMs;
    const count = inWindow ? Number(current.count || 0) : 0;
    if (count >= limit) return false;
    transaction.set(ref, {
      bucket,
      windowStart: inWindow ? windowStart : now,
      count: count + 1,
      // El cron de limpieza borra los vencidos.
      expiresAt: new Date((inWindow ? windowStart : now) + windowMs),
    });
    return true;
  });
}

/** IP del cliente según Vercel (x-forwarded-for puede venir adulterado desde el cliente). */
export function clientIp(req: VercelRequest): string {
  const header = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '';
  return String(Array.isArray(header) ? header[0] : header).split(',')[0].trim() || 'unknown';
}
