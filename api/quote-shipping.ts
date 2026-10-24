/**
 * Vercel Serverless Function — Cotización segura de Envíos
 * ================================================================
 * Ejecuta la cotización en el servidor sin exponer tokens ni credenciales
 * de Correo Argentino al navegador.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCanonicalShippingQuotes, isValidShippingZipCode } from './_shipping.ts';

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
    const { zipCode, weightGrams, customOverridePrice } = req.body || {};

    if (!zipCode || !isValidShippingZipCode(String(zipCode))) {
      return res.status(400).json({ error: 'Código postal inválido (debe tener 4 dígitos)' });
    }

    const safeWeight = Number(weightGrams) || 500;
    const safeOverride = typeof customOverridePrice === 'number' ? customOverridePrice : null;

    const quotes = await getCanonicalShippingQuotes(String(zipCode), safeWeight, safeOverride);

    return res.status(200).json({ quotes });
  } catch (error: any) {
    console.error('[QuoteShipping] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error al cotizar envío' });
  }
}
