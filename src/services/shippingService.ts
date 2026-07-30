import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Módulo de envío — Tarifario Oficial Correo Argentino
 * ====================================================
 * Calcula costos de envío por Correo Argentino según la zona (Regional vs Nacional)
 * y la escala de peso oficial de la web de Correo Argentino (hasta 1kg, 5kg, 10kg, 15kg, 20kg, 25kg).
 */

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
};

const SETTINGS_DOC = doc(db, 'settings', 'shipping');

// In-memory cache for shipping settings
let cachedSettings: ShippingSettings | null = null;

/**
 * Obtiene la configuración de envíos desde Firestore con fallback local.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  if (cachedSettings) return cachedSettings;
  try {
    const snap = await getDoc(SETTINGS_DOC);
    if (snap.exists()) {
      const data = snap.data();
      if (data.regional && data.nacional && data.regional.w1kg) {
        cachedSettings = { ...DEFAULT_SHIPPING_SETTINGS, ...data } as ShippingSettings;
        return cachedSettings;
      }
    }
  } catch (err) {
    console.warn('[shippingService] Error cargando settings de envío de Firestore, usando defaults:', err);
  }
  cachedSettings = DEFAULT_SHIPPING_SETTINGS;
  return cachedSettings;
}

/**
 * Guarda la nueva configuración de tarifas en Firestore (Admin).
 */
export async function saveShippingSettings(settings: ShippingSettings): Promise<void> {
  await setDoc(SETTINGS_DOC, settings, { merge: true });
  cachedSettings = settings;
}

/**
 * Determina la tarifa según el peso total acumulado en gramos.
 * Rangos oficiales de Correo Argentino: Hasta 1kg, 5kg, 10kg, 15kg, 20kg, 25kg.
 */
function getRateByWeight(rates: ZoneWeightRates, weightGrams: number): number {
  if (weightGrams <= 1000) return rates.w1kg;
  if (weightGrams <= 5000) return rates.w5kg;
  if (weightGrams <= 10000) return rates.w10kg;
  if (weightGrams <= 15000) return rates.w15kg;
  if (weightGrams <= 20000) return rates.w20kg;
  if (weightGrams <= 25000) return rates.w25kg;

  // Para paquetes > 25kg, tomar la tarifa de 25kg + proporcional
  const extraKgos = Math.ceil((weightGrams - 25000) / 1000);
  return Math.round(rates.w25kg + extraKgos * 2500);
}

/**
 * Determina la zona postal oficial (Regional vs Nacional) del código postal argentino.
 * Regional: CABA, GBA, Provincia de Buenos Aires, Rosario, Córdoba, Santa Fe.
 * Nacional: Resto de las provincias argentinas.
 */
function getZoneFromZip(zipCode: string): 'regional' | 'nacional' {
  const code = parseInt(zipCode, 10);
  if (isNaN(code)) return 'nacional';

  // CABA, GBA, Prov. BsAs, Santa Fe (2000-3000), Córdoba (5000-5999)
  if (
    (code >= 1000 && code < 3100) ||
    (code >= 5000 && code < 6000) ||
    (code >= 6000 && code < 8000)
  ) {
    return 'regional';
  }

  return 'nacional';
}

/**
 * Cotiza opciones de envío con Correo Argentino basadas en la tabla oficial.
 *
 * @param zipCode - Código postal argentino de destino (4 dígitos)
 * @param totalWeight - Peso total acumulado del paquete en gramos (default: 500g)
 * @param customOverridePrice - Costo fijo opcional si el admin lo sobreescribe
 */
export async function getShippingQuotes(
  zipCode: string,
  totalWeight: number = 500,
  customOverridePrice?: number | null
): Promise<ShippingQuote[]> {
  const settings = await getShippingSettings();
  const zoneKey = getZoneFromZip(zipCode);
  const zoneRates = settings[zoneKey] || DEFAULT_SHIPPING_SETTINGS.regional;

  let basePrice = getRateByWeight(zoneRates, totalWeight);

  if (customOverridePrice && customOverridePrice > 0) {
    basePrice = customOverridePrice;
  }

  const quotes: ShippingQuote[] = [
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

  return quotes;
}

/**
 * Valida formato de código postal argentino (4 dígitos).
 */
export function isValidShippingZipCode(zipCode: string): boolean {
  return /^\d{4}$/.test(zipCode.trim());
}
