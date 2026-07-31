/**
 * Vercel Serverless Function — Aviso de stock bajo
 * ================================================================
 * Verifica productos con stock bajo y envía un email al admin.
 * Diseñado para ejecutarse vía cron (Vercel Cron Jobs) o manualmente.
 *
 * Plan gratuito: Vercel Hobby = 100 invocaciones/día.
 * Se recomienda ejecutar 1 vez al día.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@esi-secundaria.com.ar';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);

function getAdminDb() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminDb();
    const productsSnap = await db.collection('products').get();

    const lowStockProducts: any[] = [];
    productsSnap.forEach((doc) => {
      const data = doc.data();
      const stock = data.stock ?? 0;
      // -1 = digital/ilimitado, no alertar
      if (stock !== -1 && data.isActive !== false && stock <= LOW_STOCK_THRESHOLD) {
        lowStockProducts.push({
          id: doc.id,
          name: data.name,
          stock,
          category: data.category || '',
          price: data.price || 0,
        });
      }
    });

    if (lowStockProducts.length === 0) {
      console.log('[StockCheck] No hay productos con stock bajo');
      return res.status(200).json({ checked: true, lowStock: 0 });
    }

    // Si hay admin email y Resend, enviar notificación
    if (RESEND_API_KEY && ADMIN_EMAIL) {
      const productsHtml = lowStockProducts
        .map(
          (p) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">${p.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="background: #FF9800; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${p.stock} uds</span>
          </td>
        </tr>`
        )
        .join('');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">⚠️ Productos con stock bajo</h2>
          <p>Los siguientes productos tienen un stock de ${LOW_STOCK_THRESHOLD} o menos unidades:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="background: #FFF3E0;">
                <th style="padding: 8px; text-align: left;">Producto</th>
                <th style="padding: 8px; text-align: left;">Categoría</th>
                <th style="padding: 8px; text-align: center;">Stock</th>
              </tr>
            </thead>
            <tbody>${productsHtml}</tbody>
          </table>
          <p>Ingresá al <a href="${process.env.VITE_SITE_URL || ''}/admin/productos">panel de administración</a> para reponer el stock.</p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `ESI en Secundaria <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `⚠️ ${lowStockProducts.length} producto(s) con stock bajo`,
          html,
        }),
      });

      console.log(`[StockCheck] Email enviado al admin por ${lowStockProducts.length} productos bajos`);
    }

    res.status(200).json({
      checked: true,
      lowStock: lowStockProducts.length,
      products: lowStockProducts,
    });
  } catch (error: any) {
    console.error('[StockCheck] Error:', error.message || error);
    res.status(500).json({ error: 'Error al verificar stock', detail: error.message });
  }
}
