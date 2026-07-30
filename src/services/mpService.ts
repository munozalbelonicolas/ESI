import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Servicio de Configuración de Mercado Pago
 * ==========================================
 * Almacena Access Token, Public Key, Modo Sandbox y opciones de cuotas en Firestore (settings/mercadopago)
 * con fallback a variables de entorno (.env).
 */

export interface MPSettings {
  accessToken: string;
  publicKey: string;
  isSandbox: boolean;
  maxInstallments: number;
  autoReturn: boolean;
}

export const DEFAULT_MP_SETTINGS: MPSettings = {
  accessToken: import.meta.env.VITE_MP_ACCESS_TOKEN || '',
  publicKey: import.meta.env.VITE_MP_PUBLIC_KEY || '',
  isSandbox: true,
  maxInstallments: 12,
  autoReturn: true,
};

const MP_SETTINGS_DOC = doc(db, 'settings', 'mercadopago');

let cachedMPSettings: MPSettings | null = null;

/**
 * Obtiene la configuración de Mercado Pago desde Firestore con fallback a defaults/.env.
 */
export async function getMPSettings(): Promise<MPSettings> {
  if (cachedMPSettings) return cachedMPSettings;
  try {
    const snap = await getDoc(MP_SETTINGS_DOC);
    if (snap.exists()) {
      cachedMPSettings = { ...DEFAULT_MP_SETTINGS, ...snap.data() } as MPSettings;
      return cachedMPSettings;
    }
  } catch (err) {
    console.warn('[mpService] Error leyendo configuración de Mercado Pago de Firestore, usando defaults:', err);
  }
  cachedMPSettings = DEFAULT_MP_SETTINGS;
  return cachedMPSettings;
}

/**
 * Guarda las credenciales de Mercado Pago en Firestore (Admin).
 */
export async function saveMPSettings(settings: MPSettings): Promise<void> {
  await setDoc(MP_SETTINGS_DOC, settings, { merge: true });
  cachedMPSettings = settings;
}
