/**
 * Firebase Admin + autenticación compartida por las funciones de /api.
 * El prefijo "_" evita que Vercel lo exponga como endpoint.
 */

import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function ensureAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      initializeApp({ projectId });
    }
  }
}

export function getAdminDb() {
  ensureAdminApp();
  return getFirestore();
}

/** Verifica el ID token de Firebase del header Authorization y devuelve uid + si es admin. */
export async function requireUser(
  req: VercelRequest
): Promise<{ uid: string; email?: string; emailVerified: boolean; isAdmin: boolean } | null> {
  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return null;
  try {
    ensureAdminApp();
    // checkRevoked: una sesión revocada (p. ej. un admin removido) deja de valer al instante.
    const decoded = await getAuth().verifyIdToken(idToken, true);
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      isAdmin: userSnap.data()?.role === 'admin',
    };
  } catch (error: any) {
    // Solo código y mensaje: nunca el token. Sin esto, credenciales rotas se ven como un 401/403.
    console.error('[Auth] requireUser falló:', error?.code || 'sin-codigo', error?.message || error);
    return null;
  }
}

/** Returns only a verified Firebase Auth email for transactional messages. */
export async function getVerifiedUserEmail(uid: string): Promise<string | null> {
  ensureAdminApp();
  const user = await getAuth().getUser(uid);
  return user.email && user.emailVerified ? user.email : null;
}

/** Vercel Cron envía "Authorization: Bearer $CRON_SECRET". Falla cerrado si el secreto no existe. */
export function isAuthorizedCron(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(String(req.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
