import { Timestamp } from 'firebase/firestore';
import type { ShippingAddress } from './order';

export type UserRole = 'customer' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  avatarUrl?: string;
  shippingAddress?: ShippingAddress;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
