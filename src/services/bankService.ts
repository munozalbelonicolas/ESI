import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Servicio de Datos Bancarios de la Administración
 * =================================================
 * Almacena CBU, Alias, Titular, Banco y CUIT en Firestore (settings/bank)
 * para mostrarlos dinámicamente al cliente en el Checkout cuando paga por Transferencia.
 */

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  cbu: string;
  alias: string;
  cuit?: string;
  notes?: string;
}

export const DEFAULT_BANK_DETAILS: BankDetails = {
  bankName: 'Mercado Pago / Banco',
  accountHolder: 'Cristina Bronzatti',
  cbu: '0000000000000000000000',
  alias: 'ESI.SECUNDARIA.MP',
  cuit: '27-00000000-0',
  notes: 'Enviar el comprobante de pago adjuntando la foto o PDF del comprobante.',
};

const BANK_DOC = doc(db, 'settings', 'bank');

let cachedBankDetails: BankDetails | null = null;

/**
 * Obtiene los datos bancarios cargados por la administración.
 */
export async function getBankDetails(): Promise<BankDetails> {
  if (cachedBankDetails) return cachedBankDetails;
  try {
    const snap = await getDoc(BANK_DOC);
    if (snap.exists()) {
      cachedBankDetails = { ...DEFAULT_BANK_DETAILS, ...snap.data() } as BankDetails;
      return cachedBankDetails;
    }
  } catch (err) {
    console.warn('[bankService] Error leyendo datos bancarios de Firestore, usando defaults:', err);
  }
  cachedBankDetails = DEFAULT_BANK_DETAILS;
  return cachedBankDetails;
}

/**
 * Guarda los nuevos datos bancarios en Firestore (Admin).
 */
export async function saveBankDetails(details: BankDetails): Promise<void> {
  await setDoc(BANK_DOC, details, { merge: true });
  cachedBankDetails = details;
}
