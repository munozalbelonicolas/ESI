import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Módulo de envío — Tarifario Oficial Correo Argentino
 * ====================================================
 * Calcula costos de envío por Correo Argentino según la zona postal del destino
 * (CP de 4 dígitos) y el peso total acumulado del paquete (en gramos).
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
  w500g: number;
  w1kg: number;
  w3kg: number;
  w5kg: number;
}

export interface ShippingSettings {
  local: ZoneWeightRates;
  regional: ZoneWeightRates;
  nacional1: ZoneWeightRates;
  nacional2: ZoneWeightRates;
  freeShippingMin: number;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  local: { w500g: 3800, w1kg: 4750, w3kg: 6080, w5kg: 7980 },
  regional: { w500g: 5200, w1kg: 6500, w3kg: 8320, w5kg: 10920 },
  nacional1: { w500g: 6000, w1kg: 7500, w3kg: 9600, w5kg: 12600 },
  nacional2: { w500g: 7800, w1kg: 9750, w3kg: 12480, w5kg: 16380 },
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
      // Si existían settings planos de versión previa, migrar a objeto estructurado
      if (data.localRate && !data.local) {
        cachedSettings = {
          local: { w500g: data.localRate, w1kg: Math.round(data.localRate * 1.25), w3kg: Math.round(data.localRate * 1.6), w5kg: Math.round(data.localRate * 2.1) },
          regional: { w500g: data.regionalRate, w1kg: Math.round(data.regionalRate * 1.25), w3kg: Math.round(data.regionalRate * 1.6), w5kg: Math.round(data.regionalRate * 2.1) },
          nacional1: { w500g: data.nacional1Rate, w1kg: Math.round(data.nacional1Rate * 1.25), w3kg: Math.round(data.nacional1Rate * 1.6), w5kg: Math.round(data.nacional1Rate * 2.1) },
          nacional2: { w500g: data.nacional2Rate, w1kg: Math.round(data.nacional2Rate * 1.25), w3kg: Math.round(data.nacional2Rate * 1.6), w5kg: Math.round(data.nacional2Rate * 2.1) },
          freeShippingMin: data.freeShippingMin || 0,
        };
      } else {
        cachedSettings = { ...DEFAULT_SHIPPING_SETTINGS, ...data } as ShippingSettings;
      }
      return cachedSettings;
    }
  } catch (err) {
    console.warn('[shippingService] Error cargando settings de envío de Firestore, usando defaults:', err);
  }
  cachedSettings = DEFAULT_SHIPPING_SETTINGS;
  return cachedSettings;
}

/**
 * Guarda la nueva configuración de tarifas por peso en Firestore (Admin).
 */
export async function saveShippingSettings(settings: ShippingSettings): Promise<void> {
  await setDoc(SETTINGS_DOC, settings, { merge: true });
  cachedSettings = settings;
}

/**
 * Determina el tramo de peso adecuado de las configuraciones.
 */
function getRateByWeight(zoneRates: ZoneWeightRates, weightGrams: number): number {
  if (weightGrams <= 500) return zoneRates.w500g;
  if (weightGrams <= 1000) return zoneRates.w1kg;
  if (weightGrams <= 3000) return zoneRates.w3kg;
  if (weightGrams <= 5000) return zoneRates.w5kg;

  // Para > 5kg, tomar el valor de 5kg y sumar 15% por cada kg extra
  const extraKgos = Math.ceil((weightGrams - 5000) / 1000);
  return Math.round(zoneRates.w5kg * (1 + extraKgos * 0.15));
}

/**
 * Determina la zona postal del código postal argentino.
 */
function getZoneFromZip(zipCode: string): 'local' | 'regional' | 'nacional1' | 'nacional2' {
  const code = parseInt(zipCode, 10);
  if (isNaN(code)) return 'nacional1';

  if (code >= 1000 && code < 1900) return 'local';
  if ((code >= 1900 && code < 3100) || (code >= 5000 && code < 6000) || (code >= 7000 && code < 8000)) return 'regional';
  if (code >= 8000) return 'nacional2';

  return 'nacional1';
}

/**
 * Cotiza opciones de envío con Correo Argentino.
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
      price: Math.round(basePrice * 1.45),
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
