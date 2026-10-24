/**
 * Lógica canónica y segura de cotización de envíos en el servidor.
 * Protege credenciales privadas y asegura cálculos determinísticos de tarifas.
 */

import { getAdminDb } from './_admin.ts';

export interface ShippingQuote {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
  type: 'domicilio' | 'sucursal' | 'retiro';
  provider: 'Correo Argentino';
}

export interface ZoneWeightRates {
  w1kg: number;
  w5kg: number;
  w10kg: number;
  w15kg: number;
  w20kg: number;
  w25kg: number;
}

export interface ShippingSettings {
  regional: ZoneWeightRates;
  nacional: ZoneWeightRates;
  freeShippingMin: number;
  useLiveApi?: boolean;
  apiCustomerId?: string;
  apiToken?: string;
  originZipCode?: string;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  regional: {
    w1kg: 18400,
    w5kg: 21800,
    w10kg: 29300,
    w15kg: 36000,
    w20kg: 42500,
    w25kg: 51100,
  },
  nacional: {
    w1kg: 24900,
    w5kg: 30200,
    w10kg: 42600,
    w15kg: 53400,
    w20kg: 62100,
    w25kg: 76300,
  },
  freeShippingMin: 0,
  useLiveApi: false,
  originZipCode: '1425',
};

export function isValidShippingZipCode(zipCode: string): boolean {
  return /^\d{4}$/.test(String(zipCode || '').trim());
}

export function getZoneFromZip(zipCode: string): 'regional' | 'nacional' {
  const code = parseInt(zipCode, 10);
  if (isNaN(code)) return 'nacional';
  if (
    (code >= 1000 && code < 3100) ||
    (code >= 5000 && code < 6000) ||
    (code >= 6000 && code < 8000)
  ) {
    return 'regional';
  }
  return 'nacional';
}

export function getRateByWeight(rates: ZoneWeightRates, weightGrams: number): number {
  if (weightGrams <= 1000) return rates.w1kg;
  if (weightGrams <= 5000) return rates.w5kg;
  if (weightGrams <= 10000) return rates.w10kg;
  if (weightGrams <= 15000) return rates.w15kg;
  if (weightGrams <= 20000) return rates.w20kg;
  if (weightGrams <= 25000) return rates.w25kg;

  const extraKilos = Math.ceil((weightGrams - 25000) / 1000);
  return Math.round(rates.w25kg + extraKilos * 2500);
}

export async function getCanonicalShippingSettings(): Promise<ShippingSettings> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('shipping').get();
    if (snap.exists) {
      const data = snap.data() || {};
      return {
        ...DEFAULT_SHIPPING_SETTINGS,
        ...data,
        // Credenciales priorizan variables de entorno para mayor seguridad
        apiCustomerId: process.env.CORREO_ARG_CUSTOMER_ID || data.apiCustomerId || '',
        apiToken: process.env.CORREO_ARG_TOKEN || data.apiToken || '',
      };
    }
  } catch (err) {
    console.warn('[Shipping] Error leyendo settings de Firestore, usando defaults:', err);
  }
  return {
    ...DEFAULT_SHIPPING_SETTINGS,
    apiCustomerId: process.env.CORREO_ARG_CUSTOMER_ID || '',
    apiToken: process.env.CORREO_ARG_TOKEN || '',
  };
}

/**
 * Consulta la API en vivo de Correo Argentino desde el servidor con timeout controlado.
 */
async function fetchCorreoArgentinoApiServer(
  originZip: string,
  destZip: string,
  weightGrams: number,
  customerId: string,
  token: string
): Promise<ShippingQuote[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const url = 'https://api.correoargentino.com.ar/paqar/v1/rates/calculate';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Customer-ID': customerId,
      },
      body: JSON.stringify({
        originPostalCode: originZip,
        destinationPostalCode: destZip,
        weightGrams,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API Correo Argentino respondió con estado ${response.status}`);
    }

    const data: any = await response.json();
    if (Array.isArray(data.rates) && data.rates.length > 0) {
      return data.rates.map((r: any) => ({
        id: `correo-api-${r.code || r.serviceType}`,
        name: r.name || 'Correo Argentino',
        description: r.description || 'Cotización en vivo Correo Argentino',
        price: Math.round(Number(r.price || r.amount || 0)),
        estimatedDays: r.estimatedDays ? `${r.estimatedDays} días hábiles` : '3 a 6 días hábiles',
        type: r.serviceType === 'sucursal' ? 'sucursal' : 'domicilio',
        provider: 'Correo Argentino',
      }));
    }
    throw new Error('Sin tarifas en respuesta de Correo Argentino');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Genera cotizaciones de envío en servidor (sin exponer tokens al cliente).
 */
export async function getCanonicalShippingQuotes(
  zipCode: string,
  weightGrams: number = 500,
  customOverridePrice?: number | null
): Promise<ShippingQuote[]> {
  if (!isValidShippingZipCode(zipCode)) {
    throw new Error('Código postal inválido');
  }

  const settings = await getCanonicalShippingSettings();
  const safeWeight = Math.max(50, Math.min(weightGrams, 50000));

  // Intento API en vivo si está habilitada y tiene credenciales
  if (settings.useLiveApi && settings.apiToken && settings.apiCustomerId) {
    try {
      const live = await fetchCorreoArgentinoApiServer(
        settings.originZipCode || '1425',
        zipCode,
        safeWeight,
        settings.apiCustomerId,
        settings.apiToken
      );
      if (live && live.length > 0) return live;
    } catch (err: any) {
      console.warn('[Shipping] Falla en API Correo Argentino, usando matriz de respaldo:', err?.message || err);
    }
  }

  // Matriz de respaldo oficial
  const zoneKey = getZoneFromZip(zipCode);
  const zoneRates = settings[zoneKey] || DEFAULT_SHIPPING_SETTINGS.regional;
  let basePrice = getRateByWeight(zoneRates, safeWeight);

  if (customOverridePrice && customOverridePrice > 0) {
    basePrice = customOverridePrice;
  }

  return [
    {
      id: 'correo-argentino-sucursal',
      name: 'Retiro en Sucursal — Correo Argentino',
      description: 'Retirás en la sucursal de Correo Argentino más cercana',
      price: Math.round(basePrice * 0.78),
      estimatedDays: '3 a 6 días hábiles',
      type: 'sucursal',
      provider: 'Correo Argentino',
    },
    {
      id: 'correo-argentino-domicilio-clasico',
      name: 'Envío a Domicilio Clásico — Correo Argentino',
      description: 'Entrega en la puerta de tu domicilio',
      price: basePrice,
      estimatedDays: '4 a 8 días hábiles',
      type: 'domicilio',
      provider: 'Correo Argentino',
    },
    {
      id: 'correo-argentino-domicilio-express',
      name: 'Envío a Domicilio Express — Correo Argentino',
      description: 'Entrega prioritaria en domicilio',
      price: Math.round(basePrice * 1.35),
      estimatedDays: '2 a 4 días hábiles',
      type: 'domicilio',
      provider: 'Correo Argentino',
    },
  ];
}

/**
 * Calcula con precisión en servidor el costo de envío correspondiente a una orden.
 */
export async function calculateOrderShippingCost(params: {
  zipCode: string;
  weightGrams: number;
  shippingMethod?: string;
  subtotal?: number;
}): Promise<number> {
  const { zipCode, weightGrams, shippingMethod = '', subtotal = 0 } = params;

  if (!isValidShippingZipCode(zipCode)) {
    throw new Error('Código postal de envío inválido');
  }

  const settings = await getCanonicalShippingSettings();

  // Envío gratis por monto de compra
  if (settings.freeShippingMin > 0 && subtotal >= settings.freeShippingMin) {
    return 0;
  }

  const quotes = await getCanonicalShippingQuotes(zipCode, weightGrams);

  // Buscar coincidencia por id o por tipo/nombre
  const normalizedMethod = shippingMethod.toLowerCase();
  const matched =
    quotes.find((q) => q.id === shippingMethod || q.name.toLowerCase() === normalizedMethod) ||
    quotes.find((q) => normalizedMethod.includes(q.type)) ||
    quotes.find((q) => q.id === 'correo-argentino-domicilio-clasico') ||
    quotes[0];

  return matched ? matched.price : 0;
}
