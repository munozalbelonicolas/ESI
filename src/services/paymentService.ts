/**
 * Módulo de pago — Serverless Functions en Vercel (plan gratuito)
 * ================================================================
 * Las functions están en /api/ del proyecto y se deployan automáticamente
 * con Vercel. No requieren Firebase Blaze — funcionan en el plan Spark.
 *
 * Si el frontend se sirve desde Vercel, las llamadas son relativas (/api/...).
 * Si se sirve desde Firebase Hosting u otro origen, usar VITE_API_BASE_URL.
 */

import type { OrderItem } from '../types/order';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface MPPreference {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

/** Tipo para el payload que se envía a notify-purchase */
export interface NotifyPurchaseData {
  orderId: string;
  userEmail: string;
  userName: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
}

/**
 * Crea una preferencia de pago en Mercado Pago a través de la API route de Vercel.
 */
export async function createMPPreference(
  orderId: string,
  items: OrderItem[],
  payerEmail: string,
  shippingCost: number,
  discount: number
): Promise<MPPreference> {
  const res = await fetch(`${API_BASE}/api/create-mp-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      items: items.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        picture_url: item.image,
        productId: item.productId,
      })),
      payer_email: payerEmail,
      shipping_cost: shippingCost,
      discount,
    }),
  });

  if (!res.ok) {
    throw new Error('Error al crear preferencia de Mercado Pago');
  }

  return res.json();
}

/**
 * Envía email de confirmación de compra al cliente (y copia al admin).
 */
export async function sendPurchaseConfirmation(data: NotifyPurchaseData): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/notify-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: data, type: 'purchase' }),
    });
  } catch (err) {
    // No bloquear el flujo de checkout si falla el email
    console.warn('[notify-purchase] No se pudo enviar email de confirmación:', err);
  }
}
