/**
 * Módulo de pago — Interacción con Cloud Functions de Mercado Pago
 */

import type { OrderItem } from '../types/order';

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || '';

export interface MPPreference {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

/**
 * Crea una preferencia de pago en Mercado Pago a través de la Cloud Function.
 */
export async function createMPPreference(
  orderId: string,
  items: OrderItem[],
  payerEmail: string,
  shippingCost: number,
  discount: number
): Promise<MPPreference> {
  const res = await fetch(`${FUNCTIONS_BASE_URL}/createMPPreference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      items: items.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        picture_url: item.image,
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
