import { SITE_CONFIG } from '../config/site';

/**
 * Formatea un número como precio argentino.
 * Ej: 4000 → "$4.000,00"
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat(SITE_CONFIG.locale, {
    style: 'currency',
    currency: SITE_CONFIG.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calcula el porcentaje de descuento.
 */
export function calcDiscount(price: number, compareAt: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
