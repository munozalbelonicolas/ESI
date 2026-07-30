/**
 * Google Analytics 4 — Helpers
 * Wrapper liviano sobre gtag() para trackear eventos estructurados.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/** Inicializa GA4 inyectando el script en el head */
export function initAnalytics(): void {
  if (!GA_ID || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  gtag('js', new Date());
  gtag('config', GA_ID);

  (window as any).gtag = gtag;
}

/** Envía un evento custom a GA4 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>
): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }
}

/* ── Eventos específicos del negocio ── */

export function trackWhatsAppClick(page: string): void {
  trackEvent('whatsapp_click', { page, timestamp: new Date().toISOString() });
}

export function trackBeginCheckout(
  value: number,
  items: any[],
  coupon?: string
): void {
  trackEvent('begin_checkout', {
    currency: 'ARS',
    value,
    items,
    coupon: coupon || '',
  });
}

export function trackPurchase(
  transactionId: string,
  value: number,
  items: any[],
  paymentType: string
): void {
  trackEvent('purchase', {
    transaction_id: transactionId,
    currency: 'ARS',
    value,
    items,
    payment_type: paymentType,
  });
}

export function trackViewItem(
  itemId: string,
  itemName: string,
  price: number
): void {
  trackEvent('view_item', {
    currency: 'ARS',
    value: price,
    items: [{ item_id: itemId, item_name: itemName, price }],
  });
}

export function trackAddToCart(
  itemId: string,
  itemName: string,
  price: number,
  quantity: number
): void {
  trackEvent('add_to_cart', {
    currency: 'ARS',
    value: price * quantity,
    items: [{ item_id: itemId, item_name: itemName, price, quantity }],
  });
}

export function trackMPSubscription(plan: string, value: number): void {
  trackEvent('mp_subscription', { plan, value });
}
