import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Configuración de Mercado Pago editable desde el admin (settings/mercadopago).
 * Las credenciales NO se guardan acá: el servidor usa MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET,
 * que se configuran como variables de entorno en Vercel.
 */

export interface MPSettings {
  /** Cuotas máximas que ofrece el checkout (1 a 12). La aplica /api/create-mp-preference. */
  maxInstallments: number;
}

export const DEFAULT_MP_SETTINGS: MPSettings = {
  maxInstallments: 12,
};

const MP_SETTINGS_DOC = doc(db, 'settings', 'mercadopago');

export async function getMPSettings(): Promise<MPSettings> {
  const snap = await getDoc(MP_SETTINGS_DOC);
  const maxInstallments = Number(snap.data()?.maxInstallments);
  return {
    maxInstallments: Number.isInteger(maxInstallments) && maxInstallments >= 1 && maxInstallments <= 12
      ? maxInstallments
      : DEFAULT_MP_SETTINGS.maxInstallments,
  };
}

/**
 * Guarda la configuración y elimina credenciales que versiones anteriores del panel guardaban en
 * Firestore (el Access Token no debe vivir en la base).
 */
export async function saveMPSettings(settings: MPSettings): Promise<void> {
  await setDoc(MP_SETTINGS_DOC, {
    maxInstallments: settings.maxInstallments,
    accessToken: deleteField(),
    publicKey: deleteField(),
    isSandbox: deleteField(),
    autoReturn: deleteField(),
  }, { merge: true });
}
