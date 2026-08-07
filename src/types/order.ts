import { Timestamp } from 'firebase/firestore';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  isDigital: boolean;
  image: string;
  downloadUrl?: string | null; // Link de Google Drive para recursos digitales
}

export interface ShippingAddress {
  street: string;
  city: string;
  province: string;
  zipCode: string;
}

export type PaymentMethod = 'mercadopago' | 'transfer';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  shippingMethod: string;
  shippingAddress: ShippingAddress | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  mpPaymentId: string | null;
  transferProofUrl: string | null;
  status: OrderStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};
