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

export interface ShippingSettings {
  localRate: number;       // CABA y GBA (CPs 1000-1899)
  regionalRate: number;    // Prov. BsAs, Sta Fe, Cba (CPs 2000-7999 parte)
  nacional1Rate: number;   // NOA, NEA, Cuyo (CPs 3000-6000 parte)
  nacional2Rate: number;   // Patagonia (CPs 8000-9999)
  freeShippingMin: number; // Monto mínimo para envío gratis opcional (0 = desactivado)
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  localRate: 3800,
  regionalRate: 5200,
  nacional1Rate: 6000,
  nacional2Rate: 7800,
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
      cachedSettings = { ...DEFAULT_SHIPPING_SETTINGS, ...snap.data() } as ShippingSettings;
      return cachedSettings;
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
 * Calcula el multiplicador de peso según los gramos totales del paquete.
 * Escalas oficiales: 0-500g, 501g-1kg, 1kg-3kg, 3kg-5kg, >5kg.
 */
function getWeightMultiplier(weightGrams: number): number {
  if (weightGrams <= 500) return 1.0;
  if (weightGrams <= 1000) return 1.25;
  if (weightGrams <= 3000) return 1.6;
  if (weightGrams <= 5000) return 2.1;
  const extraKgos = Math.ceil((weightGrams - 5000) / 1000);
  return 2.5 + extraKgos * 0.3;
}

/**
 * Determina la zona postal del código postal argentino.
 */
function getZoneFromZip(zipCode: string): 'local' | 'regional' | 'nacional1' | 'nacional2' {
  const code = parseInt(zipCode, 10);
  if (isNaN(code)) return 'nacional1';

  // 1000 a 1899: CABA y GBA
  if (code >= 1000 && code < 1900) return 'local';
  // 1900 a 3000 o 6000 a 7600: Regional (BsAs Prov, Rosario, Santa Fe, Córdoba)
  if ((code >= 1900 && code < 3100) || (code >= 5000 && code < 6000) || (code >= 7000 && code < 8000)) return 'regional';
  // 8000+: Patagonia (Bahía Blanca sur, Río Negro, Neuquén, Chubut, Santa Cruz, Tierra del Fuego)
  if (code >= 8000) return 'nacional2';

  // Resto: NOA / NEA / Cuyo
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
  const zone = getZoneFromZip(zipCode);

  let basePrice = settings[`${zone}Rate` as keyof ShippingSettings] as number || DEFAULT_SHIPPING_SETTINGS.regionalRate;
  const weightMult = getWeightMultiplier(totalWeight);

  if (customOverridePrice && customOverridePrice > 0) {
    basePrice = customOverridePrice;
  } else {
    basePrice = Math.round(basePrice * weightMult);
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
