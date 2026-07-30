import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'admin';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
