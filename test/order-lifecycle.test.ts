import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT;
if (projectId !== 'demo-esi-local' || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Estas pruebas requieren Auth y Firestore Emulator con demo-esi-local.');
}
process.env.FIREBASE_PROJECT_ID = projectId;
process.env.RESEND_API_KEY = 'local-test-not-a-real-key';
process.env.ADMIN_EMAIL = '';
process.env.MP_ACCESS_TOKEN = 'TEST-local-not-a-real-token';
process.env.CRON_SECRET = 'local-cron-secret';
process.env.MP_WEBHOOK_SECRET = 'local-webhook-secret';
process.env.VITE_SITE_URL = 'http://localhost:5173';

const app = initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const prefix = 'lifecycle-' + Date.now();
const emails: any[] = [];
const mpPreferences: any[] = [];
/** Pagos que devuelve la API simulada de Mercado Pago (GET /v1/payments/:id). */
const mpApiPayments = new Map<string, Record<string, unknown>>();
let mpPaymentFetches = 0;
const createdDocs: FirebaseFirestore.DocumentReference[] = [];
const userIds: string[] = [];
const nativeFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === 'https://api.resend.com/emails') {
    emails.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'local-email-' + emails.length }), { status: 200 });
  }
  if (url.startsWith('https://api.mercadopago.com/checkout/preferences')) {
    mpPreferences.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'pref-' + mpPreferences.length, init_point: 'https://example.invalid/pay' }), { status: 201 });
  }
  const paymentMatch = /^https:\/\/api\.mercadopago\.com\/v1\/payments\/([^/?]+)/.exec(url);
  if (paymentMatch && mpApiPayments.has(paymentMatch[1])) {
    mpPaymentFetches++;
    return new Response(JSON.stringify(mpApiPayments.get(paymentMatch[1])), { status: 200 });
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error('La prueba bloqueó una llamada externa: ' + url);
  return nativeFetch(input, init);
};

const { applyPaymentToOrder } = await import('../api/_orderSync.ts');
const { default: createOrderHandler } = await import('../api/create-order.ts');
const { default: adminHandler } = await import('../api/admin-approve-order.ts');
const { default: preferenceHandler } = await import('../api/create-mp-preference.ts');
const { default: cronHandler } = await import('../api/release-expired-coupon-reservations.ts');
const { default: downloadHandler } = await import('../api/get-digital-download.ts');
const { default: webhookHandler } = await import('../api/mp-webhook.ts');

async function createUser(label: string, role?: 'admin') {
  const email = `${prefix}-${label}@example.test`;
  const password = randomBytes(24).toString('hex');
  const user = await auth.createUser({ email, password, emailVerified: true });
  userIds.push(user.uid);
  if (role) {
    const ref = db.collection('users').doc(user.uid);
    createdDocs.push(ref);
    await ref.set({ role });
  }
  const response = await fetch('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST +
    '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  assert.equal(response.ok, true);
  return { uid: user.uid, token: (await response.json()).idToken as string };
}

async function call(handler: any, opts: { token?: string; body?: unknown; query?: Record<string, string>; method?: string; headers?: Record<string, string> }) {
  const result: { code: number; body: any } = { code: 200, body: null };
  const res: any = {
    setHeader() {},
    status(code: number) { result.code = code; return this; },
    json(body: unknown) { result.body = body; return this; },
    end() { return this; },
    redirect(code: number, location: string) { result.code = code; result.body = { location }; return this; },
  };
  await handler({
    method: opts.method || 'POST',
    headers: { ...(opts.token ? { authorization: 'Bearer ' + opts.token } : {}), ...(opts.headers || {}) },
    body: opts.body ?? {},
    query: opts.query || {},
  } as any, res);
  return result;
}

function track<T extends FirebaseFirestore.DocumentReference>(ref: T): T {
  createdDocs.push(ref);
  return ref;
}

async function seedCoupon(label: string, fields: Record<string, unknown>) {
  const ref = track(db.collection('coupons').doc(`${prefix}-${label}`));
  const code = `${prefix}-${label}`.toUpperCase();
  await ref.set({ code, type: 'percentage', value: 10, isActive: true, maxUses: 0, usedCount: 0, reservedCount: 0, minPurchase: 0, ...fields });
  return { ref, code };
}

/** Pedido de Mercado Pago con reserva de cupón vigente, como lo deja create-order. */
async function seedMpOrderWithCoupon(label: string, couponRef: FirebaseFirestore.DocumentReference, code: string, userId: string) {
  const orderRef = track(db.collection('orders').doc(`${prefix}-${label}`));
  const reservationRef = track(db.collection('couponReservations').doc(orderRef.id));
  await orderRef.set({
    userId, userName: 'Comprador ficticio',
    items: [{ productId: digitalId, name: 'Material ficticio', price: 100, quantity: 1, isDigital: true }],
    subtotal: 100, discount: 10, total: 90, expectedTotal: 90,
    paymentMethod: 'mercadopago', paymentStatus: 'pending', status: 'pending',
    couponCode: code, couponReservationId: orderRef.id, createdAt: new Date(),
  });
  await reservationRef.set({
    orderId: orderRef.id, userId, couponId: couponRef.id, couponCode: code, status: 'reserved',
    paymentMethod: 'mercadopago', expiresAt: new Date(Date.now() + 60 * 60 * 1000), createdAt: new Date(),
  });
  await couponRef.update({ reservedCount: 1 });
  return { orderRef, reservationRef };
}

function mpPayment(orderId: string, id: string, status: string, amount = 90) {
  track(db.collection('mpPayments').doc(id));
  return { id, status, external_reference: orderId, currency_id: 'ARS', transaction_amount: amount };
}

const digitalId = prefix + '-digital';
const physicalId = prefix + '-physical';
let buyer: { uid: string; token: string };
let admin: { uid: string; token: string };

before(async () => {
  buyer = await createUser('buyer');
  admin = await createUser('admin', 'admin');
  await track(db.collection('products').doc(digitalId)).set({ name: 'Material ficticio', price: 100, isDigital: true, isActive: true });
  await track(db.collection('productDownloads').doc(digitalId)).set({ downloadUrl: 'https://example.invalid/material' });
  await track(db.collection('products').doc(physicalId)).set({ name: 'Libro ficticio', price: 1000, isDigital: false, isActive: true, stock: 1, weightGrams: 400 });
});

after(async () => {
  globalThis.fetch = nativeFetch;
  const extra = await db.collection('couponReservations').where('userId', 'in', userIds).get();
  const events = await db.collection('downloadEvents').where('userId', 'in', userIds).get();
  const limits = await db.collection('rateLimits').get();
  const refs = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const ref of [...createdDocs, ...extra.docs.map((d) => d.ref), ...events.docs.map((d) => d.ref), ...limits.docs.map((d) => d.ref)]) refs.set(ref.path, ref);
  const batch = db.batch();
  for (const ref of refs.values()) batch.delete(ref);
  await batch.commit();
  await Promise.all(userIds.map((uid) => auth.deleteUser(uid)));
  await deleteApp(app);
});

describe('Pagos de Mercado Pago', () => {
  it('un pago rechazado no libera el cupón y el reintento aprobado lo consume (H1)', async () => {
    const { ref: couponRef, code } = await seedCoupon('retry', { maxUses: 1 });
    const { orderRef, reservationRef } = await seedMpOrderWithCoupon('retry', couponRef, code, buyer.uid);

    const rejected = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-retry-1`, 'rejected'));
    assert.equal(rejected.paymentStatus, 'rejected');
    assert.equal((await reservationRef.get()).data()!.status, 'reserved');
    assert.equal((await couponRef.get()).data()!.reservedCount, 1);

    const approved = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-retry-2`, 'approved'));
    assert.equal(approved.paymentStatus, 'approved');
    assert.equal(approved.mismatch, undefined);
    const coupon = (await couponRef.get()).data()!;
    assert.equal(coupon.usedCount, 1);
    assert.equal(coupon.reservedCount, 0);
    assert.equal((await reservationRef.get()).data()!.status, 'consumed');
  });

  it('una reserva ya liberada se vuelve a consumir al aprobar si queda cupo (H1)', async () => {
    const { ref: couponRef, code } = await seedCoupon('released', { maxUses: 2 });
    const { orderRef, reservationRef } = await seedMpOrderWithCoupon('released', couponRef, code, buyer.uid);
    await reservationRef.update({ status: 'released' });
    await couponRef.update({ reservedCount: 0 });

    const result = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-released-1`, 'approved'));
    assert.equal(result.paymentStatus, 'approved');
    assert.equal((await couponRef.get()).data()!.usedCount, 1);
    assert.equal((await reservationRef.get()).data()!.status, 'consumed');
  });

  it('una reserva liberada sin cupo deja el pago para revisión manual en lugar de excederlo', async () => {
    const { ref: couponRef, code } = await seedCoupon('nocap', { maxUses: 1, usedCount: 1 });
    const { orderRef, reservationRef } = await seedMpOrderWithCoupon('nocap', couponRef, code, buyer.uid);
    await reservationRef.update({ status: 'released' });
    await couponRef.update({ reservedCount: 0 });

    const result = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-nocap-1`, 'approved'));
    assert.equal(result.mismatch, true);
    assert.equal((await couponRef.get()).data()!.usedCount, 1);
  });

  it('un reembolso del pago que aprobó la orden revoca la descarga; otro pago no la revierte (M1)', async () => {
    const { ref: couponRef, code } = await seedCoupon('refund', {});
    const { orderRef } = await seedMpOrderWithCoupon('refund', couponRef, code, buyer.uid);
    await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-refund-1`, 'approved'));
    const download = () => call(downloadHandler, { token: buyer.token, body: { orderId: orderRef.id, productId: digitalId } });
    assert.equal((await download()).code, 200);

    const unrelated = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-refund-other`, 'refunded'));
    assert.equal(unrelated.paymentStatus, 'approved');

    const refunded = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-refund-1`, 'charged_back'));
    assert.equal(refunded.paymentStatus, 'refunded');
    const order = (await orderRef.get()).data()!;
    assert.equal(order.paymentStatus, 'refunded');
    assert.equal(order.status, 'cancelled');
    assert.equal((await download()).code, 403);
  });

  it('un pago aprobado sin stock suficiente se aprueba igual pero queda marcado (M2)', async () => {
    await db.collection('products').doc(physicalId).update({ stock: 0 });
    const orderRef = track(db.collection('orders').doc(`${prefix}-mp-nostock`));
    await orderRef.set({
      userId: buyer.uid, items: [{ productId: physicalId, name: 'Libro ficticio', price: 1000, quantity: 1, isDigital: false }],
      total: 1000, expectedTotal: 1000, paymentMethod: 'mercadopago', paymentStatus: 'pending', status: 'pending', emailSent: true,
    });
    const result = await applyPaymentToOrder(orderRef.id, mpPayment(orderRef.id, `${prefix}-nostock-1`, 'approved', 1000));
    assert.equal(result.paymentStatus, 'approved');
    const order = (await orderRef.get()).data()!;
    assert.equal(order.stockShortage[0].productId, physicalId);
    await db.collection('products').doc(physicalId).update({ stock: 1 });
  });

  it('la preferencia respeta el descuento reservado aunque el cupón se desactive después (M5)', async () => {
    const { ref: couponRef, code } = await seedCoupon('mp-deactivated', { value: 20 });
    const { orderRef } = await seedMpOrderWithCoupon('mp-deactivated', couponRef, code, buyer.uid);
    await couponRef.update({ isActive: false });
    const result = await call(preferenceHandler, { token: buyer.token, body: { orderId: orderRef.id } });
    assert.equal(result.code, 200, JSON.stringify(result.body));
    const order = (await orderRef.get()).data()!;
    assert.equal(order.discount, 20);
    assert.equal(order.expectedTotal, 80);
    assert.equal(mpPreferences.at(-1).items[0].unit_price, 80);
  });
});

describe('Creación de pedidos', () => {
  it('rechaza un pedido que supera el stock (M2)', async () => {
    const result = await call(createOrderHandler, {
      token: buyer.token,
      body: {
        userId: buyer.uid, paymentMethod: 'transfer', shippingMethod: 'correo-argentino-sucursal',
        items: [{ productId: physicalId, quantity: 2 }],
        shippingAddress: { street: 'Calle 1', city: 'Córdoba', province: 'Córdoba', zipCode: '5000' },
      },
    });
    assert.equal(result.code, 409);
    assert.match(result.body.error, /stock/i);
  });

  it('rechaza un código postal de 5 dígitos en lugar de recortarlo (L7)', async () => {
    const result = await call(createOrderHandler, {
      token: buyer.token,
      body: {
        userId: buyer.uid, paymentMethod: 'transfer', items: [{ productId: physicalId, quantity: 1 }],
        shippingAddress: { street: 'Calle 1', city: 'Córdoba', province: 'Córdoba', zipCode: '50000' },
      },
    });
    assert.equal(result.code, 400);
  });

  it('un pedido de $0 se aprueba al crearse, consume el cupón y envía las descargas (L8)', async () => {
    const { ref: couponRef, code } = await seedCoupon('free', { value: 100, maxUses: 5 });
    const before = emails.length;
    const result = await call(createOrderHandler, {
      token: buyer.token,
      body: { userId: buyer.uid, paymentMethod: 'mercadopago', items: [{ productId: digitalId, quantity: 1 }], couponCode: code },
    });
    assert.equal(result.code, 201, JSON.stringify(result.body));
    assert.equal(result.body.paymentStatus, 'approved');
    const orderRef = track(db.collection('orders').doc(result.body.orderId));
    const order = (await orderRef.get()).data()!;
    assert.equal(order.total, 0);
    assert.equal(order.paymentStatus, 'approved');
    const coupon = (await couponRef.get()).data()!;
    assert.equal(coupon.usedCount, 1);
    assert.equal(coupon.reservedCount, 0);
    assert.equal(emails.length, before + 1);
    assert.ok(emails.at(-1).html.includes('https://example.invalid/material'));
    const preference = await call(preferenceHandler, { token: buyer.token, body: { orderId: orderRef.id } });
    assert.equal(preference.code, 409);
  });

  it('limita los intentos de validar cupones (L2)', async () => {
    const tester = await createUser('coupon-guesser');
    const codes: number[] = [];
    for (let i = 0; i < 16; i++) {
      codes.push((await call(createOrderHandler, { token: tester.token, query: { action: 'validate-coupon' }, body: { code: 'NOEXISTE' + i, subtotal: 100 } })).code);
    }
    assert.deepEqual(codes.slice(0, 15), Array(15).fill(404));
    assert.equal(codes[15], 429);
  });

  it('un JSON inválido responde 400 y no 500', async () => {
    const res: any = { code: 0, setHeader() {}, status(c: number) { this.code = c; return this; }, json() { return this; } };
    const req: any = { method: 'POST', headers: { authorization: 'Bearer ' + buyer.token }, query: {} };
    Object.defineProperty(req, 'body', { get() { throw new SyntaxError('Unexpected token'); } });
    await createOrderHandler(req, res);
    assert.equal(res.code, 400);
  });
});

describe('Gestión de pedidos por el admin', () => {
  async function seedTransferOrder(label: string, couponCode?: string, couponRef?: FirebaseFirestore.DocumentReference) {
    const orderRef = track(db.collection('orders').doc(`${prefix}-${label}`));
    await orderRef.set({
      userId: buyer.uid, items: [{ productId: physicalId, name: 'Libro ficticio', price: 1000, quantity: 1, isDigital: false }],
      total: 1000, paymentMethod: 'transfer', paymentStatus: 'pending', status: 'pending', emailSent: true,
      ...(couponRef ? { couponCode, couponReservationId: orderRef.id } : {}),
    });
    if (couponRef) {
      await track(db.collection('couponReservations').doc(orderRef.id)).set({
        orderId: orderRef.id, userId: buyer.uid, couponId: couponRef.id, status: 'reserved', paymentMethod: 'transfer',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await couponRef.update({ reservedCount: 1 });
    }
    await track(db.collection('transferProofs').doc(orderRef.id)).set({ orderId: orderRef.id, imageData: 'data:image/png;base64,AAAA' });
    return orderRef;
  }

  it('cancelar desde el panel libera la reserva del cupón (M3)', async () => {
    const { ref: couponRef, code } = await seedCoupon('admin-cancel', { maxUses: 1 });
    const orderRef = await seedTransferOrder('admin-cancel', code, couponRef);
    const result = await call(adminHandler, { token: admin.token, query: { action: 'update' }, body: { orderId: orderRef.id, status: 'cancelled' } });
    assert.equal(result.code, 200, JSON.stringify(result.body));
    assert.equal((await couponRef.get()).data()!.reservedCount, 0);
    assert.equal((await db.collection('couponReservations').doc(orderRef.id).get()).data()!.status, 'released');
  });

  it('solo un admin puede cambiar estados, y un pedido pagado no se cancela sin reembolso', async () => {
    const orderRef = await seedTransferOrder('admin-guard');
    assert.equal((await call(adminHandler, { token: buyer.token, query: { action: 'update' }, body: { orderId: orderRef.id, status: 'cancelled' } })).code, 403);
    assert.equal((await call(adminHandler, { token: admin.token, body: { orderId: orderRef.id } })).code, 200);
    assert.equal((await call(adminHandler, { token: admin.token, query: { action: 'update' }, body: { orderId: orderRef.id, status: 'cancelled' } })).code, 409);
    const refund = await call(adminHandler, { token: admin.token, query: { action: 'update' }, body: { orderId: orderRef.id, paymentStatus: 'refunded' } });
    assert.equal(refund.code, 200);
    assert.equal((await orderRef.get()).data()!.paymentStatus, 'refunded');
    await db.collection('products').doc(physicalId).update({ stock: 1 });
  });

  it('aprobar una transferencia sin stock suficiente se bloquea (M2)', async () => {
    await db.collection('products').doc(physicalId).update({ stock: 0 });
    const orderRef = await seedTransferOrder('admin-nostock');
    const result = await call(adminHandler, { token: admin.token, body: { orderId: orderRef.id } });
    assert.equal(result.code, 409);
    assert.match(result.body.error, /Stock insuficiente/);
    assert.equal((await orderRef.get()).data()!.paymentStatus, 'pending');
    await db.collection('products').doc(physicalId).update({ stock: 1 });
  });
});

describe('Cron de reservas vencidas (M4)', () => {
  it('libera reservas vencidas de ambos medios y solo cancela el pedido de Mercado Pago', async () => {
    const { ref: couponRef } = await seedCoupon('cron', { maxUses: 3, reservedCount: 3 });
    const past = new Date(Date.now() - 60 * 1000);
    const seed = async (label: string, paymentMethod: string, expiresAt: Date | null, paymentStatus = 'pending') => {
      const orderRef = track(db.collection('orders').doc(`${prefix}-${label}`));
      await orderRef.set({ userId: buyer.uid, paymentMethod, paymentStatus, status: 'pending' });
      const reservationRef = track(db.collection('couponReservations').doc(orderRef.id));
      await reservationRef.set({ orderId: orderRef.id, userId: buyer.uid, couponId: couponRef.id, status: 'reserved', paymentMethod, expiresAt, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) });
      return { orderRef, reservationRef };
    };
    const transfer = await seed('cron-transfer', 'transfer', past);
    const mp = await seed('cron-mp', 'mercadopago', past, 'rejected');
    const legacy = await seed('cron-legacy', 'transfer', null);

    assert.equal((await call(cronHandler, { method: 'GET', headers: { authorization: 'Bearer wrong' } })).code, 401);
    const result = await call(cronHandler, { method: 'GET', headers: { authorization: 'Bearer local-cron-secret' } });
    assert.equal(result.code, 200, JSON.stringify(result.body));

    assert.equal((await transfer.reservationRef.get()).data()!.status, 'released');
    assert.equal((await transfer.orderRef.get()).data()!.status, 'pending');
    assert.equal((await mp.reservationRef.get()).data()!.status, 'released');
    assert.equal((await mp.orderRef.get()).data()!.status, 'cancelled');
    // La reserva sin vencimiento recibe uno a partir de su creación (hace 4 días > 72 h): se libera en esta misma corrida.
    assert.ok((await legacy.reservationRef.get()).data()!.expiresAt);
    assert.equal((await legacy.reservationRef.get()).data()!.status, 'released');
    assert.equal((await couponRef.get()).data()!.reservedCount, 0);
  });
});

describe('Webhook de Mercado Pago: firma de ambos formatos', () => {
  /** Firma como Mercado Pago: omite los pares sin valor (sin data.id en la URL no hay "id:"). */
  function signedHeaders(urlDataId: string | undefined, requestId: string) {
    const ts = String(Math.floor(Date.now() / 1000));
    const manifest = (urlDataId ? `id:${urlDataId};` : '') + `request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', 'local-webhook-secret').update(manifest).digest('hex');
    return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
  }

  async function seedApprovablePayment(label: string) {
    const { ref: couponRef, code } = await seedCoupon(label, {});
    const { orderRef } = await seedMpOrderWithCoupon(label, couponRef, code, buyer.uid);
    const paymentId = `${Date.now()}${label.length}`;
    track(db.collection('mpPayments').doc(paymentId));
    mpApiPayments.set(paymentId, { id: paymentId, status: 'approved', external_reference: orderRef.id, currency_id: 'ARS', transaction_amount: 90 });
    return { orderRef, paymentId };
  }

  it('procesa una notificación webhook firmada y aprueba el pago', async () => {
    const { orderRef, paymentId } = await seedApprovablePayment('wh-webhook');
    const result = await call(webhookHandler, {
      query: { 'data.id': paymentId, type: 'payment' },
      body: { type: 'payment', data: { id: paymentId } },
      headers: signedHeaders(paymentId, 'req-webhook'),
    });
    assert.equal(result.code, 200, JSON.stringify(result.body));
    assert.equal((await orderRef.get()).data()!.paymentStatus, 'approved');
    assert.ok(mpPaymentFetches > 0, 'el webhook firmado debe consultar el pago a Mercado Pago');
  });

  it('confirma con 200 una notificación IPN (Feed v2.0) pero no la procesa ni consulta a Mercado Pago', async () => {
    const { orderRef, paymentId } = await seedApprovablePayment('wh-ipn');
    const fetchesBefore = mpPaymentFetches;
    // Como llega en producción: la x-signature de IPN no se puede validar con la clave secreta.
    const result = await call(webhookHandler, {
      query: { id: paymentId, topic: 'payment' },
      body: { resource: paymentId, topic: 'payment' },
      headers: { 'x-signature': `ts=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`, 'x-request-id': 'req-ipn', 'user-agent': 'MercadoPago Feed v2.0 payment' },
    });
    assert.equal(result.code, 200);
    assert.deepEqual(result.body, { ignored: 'ipn' });
    assert.equal((await orderRef.get()).data()!.paymentStatus, 'pending');
    assert.equal(mpPaymentFetches, fetchesBefore);
  });

  it('rechaza una notificación cuya firma no corresponde a su URL', async () => {
    const paymentId = `${Date.now()}9`;
    // Firmada como IPN (sin id) pero enviada con data.id en la URL.
    const result = await call(webhookHandler, {
      query: { 'data.id': paymentId, type: 'payment' },
      body: { type: 'payment', data: { id: paymentId } },
      headers: signedHeaders(undefined, 'req-forged'),
    });
    assert.equal(result.code, 401);
    assert.equal(result.body.reason, undefined);
  });
});
