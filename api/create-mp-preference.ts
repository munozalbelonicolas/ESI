/**
 * Vercel Serverless Function — Crear preferencia de Mercado Pago
 * ================================================================
 * Recibe los items del carrito desde el frontend y crea una preferencia
 * de pago en Mercado Pago usando el SDK de Node (server-side).
 *
 * Plan gratuito: Vercel Hobby = 100 invocaciones/día, más que suficiente.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago-sdk-node';

const mpAccessToken = process.env.MP_ACCESS_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!mpAccessToken) {
    console.error('[MP] MP_ACCESS_TOKEN no configurado');
    return res.status(500).json({ error: 'Mercado Pago no configurado' });
  }

  try {
    const { orderId, items, payerEmail, shippingCost, discount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' });
    }

    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });

    // Items para MP
    const mpItems = items.map((item: any) => ({
      id: item.productId || item.id || '',
      title: item.name?.slice(0, 256) || 'Producto',
      quantity: item.quantity || 1,
      unit_price: Number(item.unit_price || item.price || 0),
      currency_id: 'ARS',
      picture_url: item.image || '',
    }));

    // Envío como item separado si hay costo
    if (shippingCost && shippingCost > 0) {
      mpItems.push({
        id: 'shipping',
        title: 'Envío',
        quantity: 1,
        unit_price: Number(shippingCost),
        currency_id: 'ARS',
      });
    }

    // Descuento como item negativo si hay
    if (discount && discount > 0) {
      mpItems.push({
        id: 'discount',
        title: 'Descuento (cupón)',
        quantity: 1,
        unit_price: -Math.abs(Number(discount)),
        currency_id: 'ARS',
      });
    }

    const preferenceData = {
      items: mpItems,
      payer: {
        email: payerEmail || '',
      },
      metadata: {
        orderId: orderId || '',
      },
      back_urls: {
        success: `${process.env.VITE_SITE_URL || ''}/checkout/exito`,
        failure: `${process.env.VITE_SITE_URL || ''}/carrito`,
        pending: `${process.env.VITE_SITE_URL || ''}/mis-ordenes`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.VITE_SITE_URL || ''}/api/mp-webhook`,
      statement_descriptor: 'ESI Secundaria',
    };

    const preferenceClient = new Preference(mp);
    const result = await preferenceClient.create({ body: preferenceData });

    res.status(200).json({
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    });
  } catch (error: any) {
    console.error('[MP] Error creando preferencia:', error.message || error);
    res.status(500).json({
      error: 'Error al crear preferencia de pago',
      detail: error.message || String(error),
    });
  }
}
