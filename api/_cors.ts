import type { VercelRequest, VercelResponse } from '@vercel/node';

export function handleApiCors(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  const origin = String(req.headers.origin || '');
  const site = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
  const allowed = [site, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Cuerpo JSON de la solicitud, o {} si falta o es inválido.
 * Vercel parsea req.body de forma perezosa y lanza ante JSON mal formado; así la validación de cada
 * endpoint responde 400 en lugar de un 500.
 */
export function readBody(req: VercelRequest): Record<string, any> {
  try {
    const body = req.body;
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

/** IDs de documentos de Firestore aceptados en parámetros (evita rutas con "/" o "..", y valores gigantes). */
export function isValidDocId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
