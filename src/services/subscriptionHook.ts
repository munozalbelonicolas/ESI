/**
 * Hook de suscripción — Punto de enganche para futuro envío automático
 * =====================================================================
 *
 * Este módulo está preparado para que en el futuro se pueda automatizar
 * el envío de material digital a clientes que se suscriban.
 *
 * CÓMO USARLO:
 * 1. Después de una compra exitosa, llamar a onPurchaseComplete()
 * 2. Cuando el sistema de suscripciones esté implementado,
 *    llamar a onSubscriptionActivated()
 *
 * TODO FUTURO:
 * - Conectar con un servicio de email marketing (Mailchimp, Brevo, etc.)
 * - Implementar entrega automática de archivos digitales
 * - Sistema de membresía con contenido exclusivo
 */

export interface SubscriptionEvent {
  userId: string;
  email: string;
  type: 'purchase' | 'subscription';
  productIds?: string[];
  planId?: string;
  timestamp: Date;
}

/**
 * Se ejecuta después de cada compra exitosa.
 * Actualmente solo loguea el evento. En el futuro, enviar materiales
 * o agregar al cliente a una lista de email.
 */
export async function onPurchaseComplete(
  event: SubscriptionEvent
): Promise<void> {
  console.log('[SubscriptionHook] Compra completada:', event);

  // TODO: Implementar envío de material digital al email del comprador
  // TODO: Agregar comprador a lista de email marketing
  // TODO: Trigger para Cloud Function de entrega automática
}

/**
 * Se ejecuta cuando un usuario activa una suscripción.
 * Placeholder para futuro sistema de membresía.
 */
export async function onSubscriptionActivated(
  event: SubscriptionEvent
): Promise<void> {
  console.log('[SubscriptionHook] Suscripción activada:', event);

  // TODO: Activar acceso a contenido exclusivo
  // TODO: Programar envíos periódicos de material
  // TODO: Notificar al admin
}
