import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppliedCoupon, Coupon, CouponFormData } from '../types/coupon';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const COLLECTION = 'coupons';

/**
 * Valida un cupón contra el backend (la colección /coupons solo es legible por admins).
 * Retorna los datos para calcular el descuento, o null si no es válido.
 */
export async function validateCoupon(
  code: string,
  purchaseTotal: number
): Promise<AppliedCoupon | null> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');
  const response = await fetch(`${API_BASE}/api/validate-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, subtotal: purchaseTotal }),
  });
  if (response.status === 404) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo validar el cupón');
  return result as AppliedCoupon;
}

/**
 * Calcula el descuento según el tipo de cupón.
 */
export function calculateDiscount(coupon: AppliedCoupon, subtotal: number): number {
  if (coupon.type === 'percentage') {
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(coupon.value, subtotal);
}

/**
 * Obtiene todos los cupones (admin).
 */
export async function getAllCoupons(): Promise<Coupon[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
}

/**
 * Crea un nuevo cupón (admin).
 */
export async function createCoupon(data: CouponFormData): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    code: data.code.toUpperCase(),
    usedCount: 0,
    reservedCount: 0,
    expiresAt: data.expiresAt ? Timestamp.fromDate(new Date(data.expiresAt)) : null,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

/**
 * Actualiza un cupón (admin).
 */
export async function updateCoupon(
  id: string,
  data: Partial<CouponFormData>
): Promise<void> {
  const updates: any = { ...data };
  if (data.code) updates.code = data.code.toUpperCase();
  if (data.expiresAt !== undefined) {
    updates.expiresAt = data.expiresAt
      ? Timestamp.fromDate(new Date(data.expiresAt))
      : null;
  }
  await updateDoc(doc(db, COLLECTION, id), updates);
}

/**
 * Elimina un cupón (admin).
 */
export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
