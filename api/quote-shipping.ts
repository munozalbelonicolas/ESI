/**
 * Vercel Serverless Function — Cotización segura de Envíos
 * ================================================================
 * Ejecuta la cotización en el servidor sin exponer tokens ni credenciales
 * de Correo Argentino al navegador.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_admin.js';
import { isValidDocId, readBody } from './_cors.js';
import { clientIp, consumeRateLimit } from './_rateLimit.js';
import { getCanonicalShippingQuotes, isValidShippingZipCode } from './_shipping.js';

function allowedOrigins(): string[] {
  const site = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return [site, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Endpoint público (la ficha de producto cotiza sin login): se limita por IP porque cada
    // consulta puede llamar a la API de Correo Argentino con las credenciales de la tienda.
    if (!(await consumeRateLimit('quote-shipping', clientIp(req), 30, 10 * 60 * 1000))) {
      return res.status(429).json({ error: 'Demasiadas cotizaciones. Esperá unos minutos.' });
    }

    const { zipCode, weightGrams, productId } = readBody(req);

    if (!zipCode || !isValidShippingZipCode(String(zipCode))) {
      return res.status(400).json({ error: 'Código postal inválido (debe tener 4 dígitos)' });
    }

    const weight = Number(weightGrams);
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 500;
    // El precio de envío personalizado sale del producto en Firestore, nunca del navegador.
    let safeOverride: number | null = null;
    if (productId !== undefined) {
      if (!isValidDocId(productId)) return res.status(400).json({ error: 'Producto inválido' });
      const custom = Number((await getAdminDb().collection('products').doc(productId).get()).data()?.customShippingPrice);
      safeOverride = Number.isFinite(custom) && custom > 0 ? custom : null;
    }

    const quotes = await getCanonicalShippingQuotes(String(zipCode), safeWeight, safeOverride);

    return res.status(200).json({ quotes });
  } catch (error: any) {
    console.error('[QuoteShipping] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error al cotizar envío' });
  }
}
