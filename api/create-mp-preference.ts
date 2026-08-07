/**
 * Vercel Serverless Function — Crear preferencia de Mercado Pago
 * ================================================================
 * Recibe los items del carrito desde el frontend y crea una preferencia
 * de pago en Mercado Pago usando el SDK oficial de Node (mercadopago).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN;

  if (!mpAccessToken) {
    console.error('[MP] MP_ACCESS_TOKEN no configurado');
    return res.status(500).json({ error: 'Mercado Pago no configurado' });
  }

  try {
    const {
      orderId,
      items,
      payerEmail,
      payer_email,
      shippingCost,
      shipping_cost,
      discount,
    } = req.body || {};

    const email = payerEmail || payer_email || '';
    const finalShippingCost = Number(shippingCost || shipping_cost || 0);
    const rawDiscount = Number(discount || 0);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' });
    }

    const subtotal = items.reduce(
      (acc: number, i: any) =>
        acc + Number(i.unit_price || i.price || 0) * Number(i.quantity || 1),
      0
    );

    const discountAmount = Math.min(rawDiscount, subtotal);
    const discountFactor = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

    const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });

    // Items para MP con descuento aplicado proporcionalmente
    const mpItems: Array<{
      id: string;
      title: string;
      quantity: number;
      unit_price: number;
      currency_id: string;
      picture_url?: string;
    }> = items.map((item: any) => {
      const origPrice = Number(item.unit_price || item.price || 0);
      const finalUnitPrice = Math.max(
        0.01,
        Math.round(origPrice * discountFactor * 100) / 100
      );

      return {
        id: String(item.productId || item.id || ''),
        title: String(item.name || item.title || 'Producto').slice(0, 256),
        quantity: Number(item.quantity || 1),
        unit_price: finalUnitPrice,
        currency_id: 'ARS',
        picture_url: item.image || item.picture_url || '',
      };
    });

    if (finalShippingCost > 0) {
      mpItems.push({
        id: 'shipping',
        title: 'Envío',
        quantity: 1,
        unit_price: finalShippingCost,
        currency_id: 'ARS',
        picture_url: '',
      });
    }

    const rawSiteUrl = process.env.VITE_SITE_URL || '';
    const isLocalhost = !rawSiteUrl || rawSiteUrl.includes('localhost') || rawSiteUrl.includes('127.0.0.1');
    const baseUrl = isLocalhost ? 'http://localhost:5173' : rawSiteUrl;

    const preferenceData: any = {
      items: mpItems,
      payer: {
        email: email || 'test_user_1234567@testuser.com',
      },
      metadata: {
        orderId: orderId || '',
      },
      back_urls: {
        success: `${baseUrl}/checkout/exito`,
        failure: `${baseUrl}/carrito`,
        pending: `${baseUrl}/mis-ordenes`,
      },
      statement_descriptor: 'ESI Secundaria',
    };

    if (!isLocalhost) {
      preferenceData.auto_return = 'approved';
      preferenceData.notification_url = `${baseUrl}/api/mp-webhook`;
    }

    const preferenceClient = new Preference(mp);
    const result = await preferenceClient.create({ body: preferenceData });

    return res.status(200).json({
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    });
  } catch (error: any) {
    console.error('[MP] Error creando preferencia:', error.message || error);
    return res.status(500).json({
      error: 'Error al crear preferencia de pago',
      detail: error.message || String(error),
    });
  }
}
