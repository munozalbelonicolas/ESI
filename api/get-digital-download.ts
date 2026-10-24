/**
 * Vercel Serverless Function — Descarga segura de productos digitales
 * ===================================================================
 * Verifica en servidor que la orden pertenezca al usuario autenticado,
 * que el pago esté estrictamente 'approved' y que el producto digital
 * esté incluido en la orden antes de entregar la URL del archivo.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, requireUser } from './_admin.ts';
import { freeProductDownload } from './_freeProductDownload.ts';

function allowedOrigins(): string[] {
  const site = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return [site, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // /api/get-free-product-download se reescribe a ?action=free (límite de 12 funciones en Hobby)
  if (req.query?.action === 'free') return freeProductDownload(req, res);

  const origin = String(req.headers.origin || '');
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Iniciá sesión para acceder a tus descargas' });
    }

    const orderId =
      req.method === 'POST' ? req.body?.orderId : req.query?.orderId;
    const productId =
      req.method === 'POST' ? req.body?.productId : req.query?.productId;

    if (!orderId || !productId || typeof orderId !== 'string' || typeof productId !== 'string') {
      return res.status(400).json({ error: 'orderId y productId requeridos' });
    }

    const db = getAdminDb();
    const orderSnap = await db.collection('orders').doc(orderId).get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = orderSnap.data() || {};

    // 1. Validar titularidad o rol admin
    if (order.userId !== user.uid && !user.isAdmin) {
      return res.status(403).json({ error: 'No autorizado a acceder a esta orden' });
    }

    // 2. Validar que el pago esté aprobado
    if (order.paymentStatus !== 'approved') {
      return res.status(403).json({
        error: 'El material estará disponible una vez que el pago esté acreditado y confirmado.',
      });
    }

    // 3. Validar que el producto esté en la orden y sea digital
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const item = items.find((i) => String(i.productId || i.id) === productId);

    if (!item) {
      return res.status(400).json({ error: 'El producto solicitado no es digital o no pertenece a esta orden' });
    }

    const productSnap = await db.collection('products').doc(productId).get();
    if (!productSnap.exists || productSnap.data()?.isDigital !== true) {
      return res.status(400).json({ error: 'El producto solicitado no es digital o no pertenece a esta orden' });
    }

    // 4. Buscar el enlace seguro de descarga: primero en la colección privada productDownloads
    let downloadUrl: string | null = null;
    const privateSnap = await db.collection('productDownloads').doc(productId).get();
    if (privateSnap.exists && privateSnap.data()?.downloadUrl) {
      downloadUrl = String(privateSnap.data()?.downloadUrl);
    }

    if (!downloadUrl) {
      return res.status(404).json({ error: 'Archivo digital no encontrado para este producto' });
    }

    return res.status(200).json({
      downloadUrl,
      productName: item.name || 'Material Digital',
    });
  } catch (error: any) {
    console.error('[DownloadProduct] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error al obtener la descarga' });
  }
}
