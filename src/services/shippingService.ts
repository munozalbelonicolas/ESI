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

/** Tarifas base de Correo Argentino por zona (pesos argentinos) */
const ZONE_BASE_RATES: Record<string, number> = {
  // CABA y GBA (Local / Z1)
  '1000': 3600, '1100': 3800, '1400': 3800, '1600': 4100, '1700': 4100, '1800': 4100,
  // Provincia de Buenos Aires / Santa Fe / Córdoba (Regional / Z2)
  '2000': 4800, '3000': 5200, '5000': 5400, '6000': 5200, '7000': 5000,
  // NOA / Cuyo / NEA (Nacional 1 / Z3)
  '4000': 5800, '5500': 6200, '3300': 6000, '4400': 6400,
  // Patagonia / Extremo Sur (Nacional 2 / Z4)
  '8000': 6900, '9000': 7800, '9410': 8500,
};

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
 * Obtiene la tarifa base estimada según el Código Postal argentino.
 */
function getBaseRateByZip(zipCode: string): number {
  if (ZONE_BASE_RATES[zipCode]) return ZONE_BASE_RATES[zipCode];
  const prefix = zipCode.charAt(0) + '000';
  return ZONE_BASE_RATES[prefix] || 5200; // Tarifa promedio nacional por defecto
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
  // Simular pequeña latencia de cálculo
  await new Promise((r) => setTimeout(r, 300));

  let basePrice = getBaseRateByZip(zipCode);
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
