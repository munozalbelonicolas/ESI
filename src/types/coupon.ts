import { Timestamp } from 'firebase/firestore';

export type CouponType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  reservedCount?: number;
  isActive: boolean;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
}

/** Lo que devuelve /api/validate-coupon: solo lo necesario para mostrar el descuento. */
export type AppliedCoupon = Pick<Coupon, 'code' | 'type' | 'value'>;

export interface CouponFormData {
  code: string;
  type: CouponType;
  value: number;
  minPurchase: number;
  maxUses: number;
  isActive: boolean;
  expiresAt: string | null;
}
