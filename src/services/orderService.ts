import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { Order, OrderItem, ShippingAddress, PaymentMethod } from '../types/order';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Iniciá sesión para continuar');
  const response = await fetch(`${API_BASE}/api/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo crear el pedido');
  return result.orderId;
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
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
  } catch (err: any) {
    console.warn('[orderService] Falta índice compuesto en Firestore, usando fallback en memoria:', err?.message || err);
    try {
      const qFallback = query(collection(db, COLLECTION), where('userId', '==', userId));
      const snap = await getDocs(qFallback);
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
      return orders.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });
    } catch (fallbackErr) {
      console.error('[orderService] Error al obtener órdenes:', fallbackErr);
      return [];
    }
  }
}

/**
 * Obtiene todas las órdenes (admin).
 */
export async function getAllOrders(): Promise<Order[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
  } catch (err) {
    console.warn('[orderService] Error obteniendo todas las órdenes, fallback:', err);
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
      return orders.sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || 0;
        const timeB = (b.createdAt as any)?.seconds || 0;
        return timeB - timeA;
      });
    } catch {
      return [];
    }
  }
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
 * Marca que la notificación por email de la orden ya fue enviada.
 */
export async function updateOrderEmailSent(orderId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, orderId), {
    emailSent: true,
    updatedAt: Timestamp.now(),
  });
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

/**
 * Elimina una orden por ID (con fallback a cancelación si faltan permisos de borrado en Firestore).
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');
  const response = await fetch(`${API_BASE}/api/cancel-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo cancelar el pedido');
}

/**
 * Aprueba una orden desde el backend como Administrador de forma segura
 * (actualiza estado, descuenta stock atómicamente y despacha email con descargas).
 */
export async function adminApproveOrder(orderId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');

  const res = await fetch(`${API_BASE}/api/admin-approve-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al aprobar la orden');
  }
}
