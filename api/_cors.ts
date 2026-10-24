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
