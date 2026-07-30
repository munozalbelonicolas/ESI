/**
 * Mercado Pago — Configuración del SDK
 * La integración real ocurre vía Cloud Functions (server-side).
 * Este archivo maneja la inicialización del SDK JS para Checkout Pro.
 */

export const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || '';

/**
 * Carga el SDK de Mercado Pago dinámicamente.
 * Retorna la instancia de MercadoPago lista para usar.
 */
export async function loadMercadoPago(): Promise<any> {
  if (!MP_PUBLIC_KEY) {
    console.warn('[MercadoPago] PUBLIC_KEY no configurada');
    return null;
  }

  if ((window as any).MercadoPago) {
    return new (window as any).MercadoPago(MP_PUBLIC_KEY);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => {
      const mp = new (window as any).MercadoPago(MP_PUBLIC_KEY);
      resolve(mp);
    };
    script.onerror = () => reject(new Error('Error al cargar SDK de Mercado Pago'));
    document.head.appendChild(script);
  });
}
