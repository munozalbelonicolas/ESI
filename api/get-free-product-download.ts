import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_admin.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const productId = req.query?.productId;
  if (typeof productId !== 'string' || !productId.trim()) {
    return res.status(400).json({ error: 'productId requerido' });
  }

  try {
    const db = getAdminDb();
    const product = await db.collection('products').doc(productId).get();
    if (!product.exists || product.data()?.isActive === false || product.data()?.isFree !== true) {
      return res.status(404).json({ error: 'Descarga gratuita no encontrada' });
    }
    const download = await db.collection('productDownloads').doc(productId).get();
    const value = download.data()?.downloadUrl;
    let secureUrl = false;
    try { secureUrl = typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { /* invalid stored URL */ }
    if (typeof value !== 'string' || !secureUrl) {
      return res.status(404).json({ error: 'Descarga gratuita no encontrada' });
    }
    return res.redirect(302, value);
  } catch (error: any) {
    console.error('[FreeProductDownload] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo obtener la descarga' });
  }
}
