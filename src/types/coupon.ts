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
  isActive: boolean;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface CouponFormData {
  code: string;
  type: CouponType;
  value: number;
  minPurchase: number;
  maxUses: number;
  isActive: boolean;
  expiresAt: string | null;
}
