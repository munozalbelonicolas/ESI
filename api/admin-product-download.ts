import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireUser } from './_admin.js';
import { handleApiCors } from './_cors.js';
import { migrateProductDownloads } from './_migrateProductDownloads.js';

function validHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // /api/admin-migrate-product-downloads se reescribe a ?action=migrate (límite de 12 funciones en Hobby)
  if (req.query?.action === 'migrate') return migrateProductDownloads(req, res);
  if (handleApiCors(req, res, ['GET', 'POST', 'DELETE'])) return;
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    if (!user?.isAdmin) return res.status(403).json({ error: 'Acceso restringido a administradores' });

    const productId = req.method === 'GET' ? req.query?.productId : req.body?.productId;
    if (typeof productId !== 'string' || !productId.trim()) {
      return res.status(400).json({ error: 'productId requerido' });
    }

    const db = getAdminDb();
    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) return res.status(404).json({ error: 'Producto no encontrado' });

    const downloadRef = db.collection('productDownloads').doc(productId);
    if (req.method === 'GET') {
      const snap = await downloadRef.get();
      // Admin-only compatibility path so existing products remain editable
      // until the one-time migration has run.
      return res.status(200).json({ downloadUrl: snap.data()?.downloadUrl || productSnap.data()?.digitalFileUrl || '' });
    }

    if (req.method === 'DELETE') {
      await productRef.update({ publicCatalogReady: false });
      await downloadRef.delete();
      await productRef.update({
        hasDigitalDownload: false,
        digitalFileUrl: FieldValue.delete(),
        publicCatalogReady: true,
      });
      return res.status(200).json({ success: true });
    }

    const downloadUrl = validHttpsUrl(req.body?.downloadUrl);
    if (!downloadUrl) return res.status(400).json({ error: 'Se requiere una URL HTTPS válida' });

    await productRef.update({ publicCatalogReady: false });
    await downloadRef.set({ downloadUrl, updatedAt: new Date(), updatedBy: user.uid });
    await productRef.update({
      hasDigitalDownload: true,
      digitalFileUrl: FieldValue.delete(),
      publicCatalogReady: true,
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[ProductDownload] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo guardar el enlace privado' });
  }
}
