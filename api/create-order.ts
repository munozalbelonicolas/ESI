import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, requireUser } from './_admin.js';
import { reserveCoupon } from './_couponReservations.js';
import { calculateOrderShippingCost, isValidShippingZipCode } from './_shipping.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (!user.emailVerified) return res.status(403).json({ error: 'Verificá tu email antes de comprar' });

    const data = req.body || {};
    if (data.userId !== user.uid || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > 50) {
      return res.status(400).json({ error: 'Datos de pedido inválidos' });
    }
    if (!['transfer', 'mercadopago'].includes(data.paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc();
    const requestedItems = data.items as any[];
    if (requestedItems.some((item) => !item || typeof item.productId !== 'string' || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50)) {
      return res.status(400).json({ error: 'Productos o cantidades inválidos' });
    }
    const uniqueIds = [...new Set(requestedItems.map((item) => item.productId as string))];
    const productSnaps = await Promise.all(uniqueIds.map((id) => db.collection('products').doc(id).get()));
    const products = new Map(productSnaps.map((snap) => [snap.id, { exists: snap.exists, data: snap.data() || {} }]));
    const canonicalItems: any[] = [];
    let subtotal = 0;
    let totalWeightGrams = 0;
    let transferDiscount = 0;
    for (const item of requestedItems) {
      const product = products.get(item.productId);
      const p = product?.data;
      if (!product?.exists || !p || p.isActive !== true) {
        return res.status(409).json({ error: 'Un producto ya no está disponible' });
      }
      const quantity = Number(item.quantity);
      const price = Number(p.price);
      if (!Number.isFinite(price) || price <= 0) return res.status(409).json({ error: 'Producto con precio inválido' });
      const isDigital = p.isDigital === true;
      const productName = typeof p.name === 'string' ? p.name.slice(0, 180) : 'Producto';
      const image = Array.isArray(p.images) ? p.images.find((url: unknown) => typeof url === 'string' && /^https:\/\//.test(url)) || '' : '';
      canonicalItems.push({ productId: item.productId, name: productName, price, quantity, isDigital, image });
      subtotal += price * quantity;
      if (data.paymentMethod === 'transfer') {
        const percent = Number(p.transferDiscountPercent || 0);
        if (Number.isFinite(percent) && percent > 0) {
          transferDiscount += Math.round(price * quantity * (Math.min(percent, 100) / 100));
        }
      }
      if (!isDigital) {
        const weight = Number(p.weightGrams);
        totalWeightGrams += (Number.isFinite(weight) && weight > 0 ? weight : 300) * quantity;
      }
    }
    const allDigital = canonicalItems.every((item) => item.isDigital);
    const shippingAddress = data.shippingAddress && typeof data.shippingAddress === 'object'
      ? {
          street: String(data.shippingAddress.street || '').slice(0, 180),
          city: String(data.shippingAddress.city || '').slice(0, 120),
          province: String(data.shippingAddress.province || '').slice(0, 80),
          zipCode: String(data.shippingAddress.zipCode || '').slice(0, 4),
        }
      : null;
    let shippingCost = 0;
    if (!allDigital) {
      if (!shippingAddress || !isValidShippingZipCode(shippingAddress.zipCode)) {
        return res.status(400).json({ error: 'Código postal de envío requerido y debe ser de 4 dígitos' });
      }
      shippingCost = await calculateOrderShippingCost({
        zipCode: shippingAddress.zipCode,
        weightGrams: Math.max(totalWeightGrams, 300),
        shippingMethod: typeof data.shippingMethod === 'string' ? data.shippingMethod.slice(0, 120) : '',
        subtotal,
      });
    }

    const orderData = {
      userId: user.uid,
      userEmail: user.email || '',
      userName: typeof data.userName === 'string' ? data.userName.slice(0, 120) : '',
      items: canonicalItems,
      subtotal,
      discount: 0,
      couponCode: typeof data.couponCode === 'string' ? data.couponCode.trim().toUpperCase() : null,
      shippingCost,
      shippingMethod: allDigital ? 'Digital' : typeof data.shippingMethod === 'string' ? data.shippingMethod.slice(0, 120) : '',
      shippingAddress: allDigital ? null : shippingAddress,
      total: 0,
      paymentMethod: data.paymentMethod,
      paymentStatus: 'pending',
      mpPaymentId: null,
      transferProofUrl: null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.runTransaction(async (transaction) => {
      const reservation = await reserveCoupon(
        db, transaction, orderRef, orderData.couponCode, orderData.subtotal, orderData.paymentMethod
      );
      const discount = Math.min(subtotal, reservation.couponDiscount + transferDiscount);
      transaction.create(orderRef, {
        ...orderData,
        discount,
        total: Math.max(0, subtotal - discount + shippingCost),
        couponCode: reservation.couponCode,
        couponReservationId: reservation.reservationId,
      });
    });
    return res.status(201).json({ orderId: orderRef.id });
  } catch (error: any) {
    if (error?.message === 'COUPON_INVALID' || error?.message === 'COUPON_UNAVAILABLE') {
      return res.status(409).json({ error: 'El cupón ya no está disponible. Actualizá el carrito e intentá nuevamente.' });
    }
    if (error?.message === 'SHIPPING_INVALID') return res.status(400).json({ error: 'Datos de envío inválidos' });
    console.error('[CreateOrder] Error:', error?.message || error);
    return res.status(500).json({ error: 'No se pudo crear el pedido' });
  }
}
