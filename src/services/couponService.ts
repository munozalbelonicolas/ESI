import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Coupon, CouponFormData } from '../types/coupon';

const COLLECTION = 'coupons';

/**
 * Valida y aplica un cupón de descuento.
 * Retorna el cupón si es válido, o null si no lo es.
 */
export async function validateCoupon(
  code: string,
  purchaseTotal: number
): Promise<Coupon | null> {
  const q = query(
    collection(db, COLLECTION),
    where('code', '==', code.toUpperCase()),
    where('isActive', '==', true),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;

  // Verificar si expiró
  if (coupon.expiresAt && coupon.expiresAt.toMillis() < Date.now()) return null;

  // Verificar usos máximos
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return null;

  // Verificar compra mínima
  if (purchaseTotal < coupon.minPurchase) return null;

  return coupon;
}

/**
 * Calcula el descuento según el tipo de cupón.
 */
export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.type === 'percentage') {
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(coupon.value, subtotal);
}

/**
 * Incrementa el contador de usos de un cupón.
 */
export async function incrementCouponUsage(couponId: string): Promise<void> {
  const ref = doc(db, COLLECTION, couponId);
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('__name__', '==', couponId))
  );
  if (!snap.empty) {
    const current = snap.docs[0].data().usedCount || 0;
    await updateDoc(ref, { usedCount: current + 1 });
  }
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
