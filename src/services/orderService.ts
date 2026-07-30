import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Order, OrderItem, ShippingAddress, PaymentMethod } from '../types/order';

const COLLECTION = 'orders';

export interface CreateOrderData {
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
}

/**
 * Crea una nueva orden.
 */
export async function createOrder(data: CreateOrderData): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    paymentStatus: 'pending',
    mpPaymentId: null,
    transferProofUrl: null,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

/**
 * Obtiene una orden por ID.
 */
export async function getOrderById(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Order;
}

/**
 * Obtiene todas las órdenes de un usuario.
 */
export async function getUserOrders(userId: string): Promise<Order[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
}

/**
 * Obtiene todas las órdenes (admin).
 */
export async function getAllOrders(): Promise<Order[]> {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
}

/**
 * Actualiza el estado de una orden.
 */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, orderId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Actualiza el estado de pago y el ID de Mercado Pago.
 */
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: Order['paymentStatus'],
  mpPaymentId?: string
): Promise<void> {
  const updates: any = {
    paymentStatus,
    updatedAt: Timestamp.now(),
  };
  if (mpPaymentId) updates.mpPaymentId = mpPaymentId;
  if (paymentStatus === 'approved') updates.status = 'paid';
  await updateDoc(doc(db, COLLECTION, orderId), updates);
}

/**
 * Guarda la URL del comprobante de transferencia.
 */
export async function saveTransferProof(
  orderId: string,
  proofUrl: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, orderId), {
    transferProofUrl: proofUrl,
    updatedAt: Timestamp.now(),
  });
}
