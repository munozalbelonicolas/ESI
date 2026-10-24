/**
 * Módulo de pago — Serverless Functions en Vercel (plan gratuito)
 * ================================================================
 * Las functions están en /api/ del proyecto y se deployan automáticamente
 * con Vercel. No requieren Firebase Blaze — funcionan en el plan Spark.
 *
 * Si el frontend se sirve desde Vercel, las llamadas son relativas (/api/...).
 * Si se sirve desde Firebase Hosting u otro origen, usar VITE_API_BASE_URL.
 */

import type { OrderItem, ShippingAddress } from '../types/order';
import { auth } from '../config/firebase';

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
  shippingAddress?: ShippingAddress | null;
  shippingMethod?: string;
}

/** Devuelve el header Authorization con el ID token de Firebase del usuario actual. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Iniciá sesión para continuar');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/**
 * Crea una preferencia de pago en Mercado Pago a través de la API route de Vercel.
 * Solo se envía el orderId: el servidor calcula precios, descuento y envío desde Firestore.
 */
export async function createMPPreference(orderId: string): Promise<MPPreference> {
  const res = await fetch(`${API_BASE}/api/create-mp-preference`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al crear preferencia de Mercado Pago');
  }

  return res.json();
}

/**
 * Verifica contra Mercado Pago el estado real de una orden (lo hace el servidor)
 * y devuelve el paymentStatus resultante.
 */
export async function verifyOrderPayment(orderId: string): Promise<'pending' | 'approved' | 'rejected' | 'refunded'> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Iniciá sesión para verificar tu pago');
  const res = await fetch(`${API_BASE}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo verificar el pago');
  }
  const data = await res.json();
  return data.paymentStatus;
}

/**
 * Envía email de confirmación de compra al cliente (y copia al admin).
 */
export async function sendPurchaseConfirmation(data: NotifyPurchaseData): Promise<void> {
  try {
    // Solo se envía el orderId: el servidor arma el email desde la orden real
    await fetch(`${API_BASE}/api/notify-purchase`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ orderId: data.orderId }),
    });
  } catch (err) {
    // No bloquear el flujo de checkout si falla el email
    console.warn('[notify-purchase] No se pudo enviar email de confirmación:', err);
  }
}

/**
 * Solicita al servidor el enlace de descarga seguro para un producto digital
 * previa validación de orden, titularidad y estado 'approved'.
 */
export async function getDigitalDownloadUrl(orderId: string, productId: string): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/get-digital-download`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId, productId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo obtener el enlace de descarga');
  }

  const data = await res.json();
  return data.downloadUrl;
}
