/**
 * Módulo de envío — Simulador de Correo Argentino
 * ================================================
 * Este módulo está DESACOPLADO del resto de la app.
 * Cuando se consigan las credenciales reales de Correo Argentino,
 * solo hay que reemplazar la implementación interna manteniendo
 * la misma interfaz (ShippingQuote y getShippingQuotes).
 */

export interface ShippingQuote {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
  type: 'domicilio' | 'sucursal' | 'retiro';
}

/** Tarifas base simuladas por zona (pesos argentinos) */
const ZONE_RATES: Record<string, number> = {
  // CABA y GBA
  '1000': 3500, '1001': 3500, '1002': 3500, '1100': 3800,
  '1400': 4000, '1600': 4200, '1700': 4200, '1800': 4200,
  // Interior
  '2000': 5000, '3000': 5500, '4000': 6000, '5000': 5800,
  '6000': 5500, '7000': 5200, '8000': 6500, '9000': 8000,
};

/**
 * Obtiene una tarifa base según el código postal.
 * Usa los primeros 1-2 dígitos para determinar la zona.
 */
function getBaseRate(zipCode: string): number {
  // Intentar match exacto
  if (ZONE_RATES[zipCode]) return ZONE_RATES[zipCode];

  // Match por primer dígito × 1000
  const zone = zipCode.charAt(0) + '000';
  return ZONE_RATES[zone] || 5000; // Default: tarifa intermedia
}

/**
 * Calcula opciones de envío según el código postal de destino.
 * Retorna múltiples opciones (domicilio, sucursal, etc.).
 *
 * @param zipCode - Código postal del destino (4 dígitos)
 * @param totalWeight - Peso total del paquete en gramos (opcional)
 */
export async function getShippingQuotes(
  zipCode: string,
  _totalWeight: number = 500
): Promise<ShippingQuote[]> {
  // Simular latencia de API real
  await new Promise((r) => setTimeout(r, 600));

  const baseRate = getBaseRate(zipCode);

  const quotes: ShippingQuote[] = [
    {
      id: 'domicilio-standard',
      name: 'Envío a domicilio — Estándar',
      description: 'Correo Argentino — Envío estándar a domicilio',
      price: baseRate,
      estimatedDays: '5 a 10 días hábiles',
      type: 'domicilio',
    },
    {
      id: 'domicilio-express',
      name: 'Envío a domicilio — Express',
      description: 'Correo Argentino — Envío express a domicilio',
      price: Math.round(baseRate * 1.5),
      estimatedDays: '2 a 4 días hábiles',
      type: 'domicilio',
    },
    {
      id: 'sucursal',
      name: 'Retiro en sucursal del correo',
      description: 'Retirás el paquete en la sucursal más cercana',
      price: Math.round(baseRate * 0.75),
      estimatedDays: '5 a 8 días hábiles',
      type: 'sucursal',
    },
  ];

  return quotes;
}

/**
 * Verifica si un código postal es válido (formato argentino).
 */
export function isValidShippingZipCode(zipCode: string): boolean {
  return /^\d{4}$/.test(zipCode);
}
