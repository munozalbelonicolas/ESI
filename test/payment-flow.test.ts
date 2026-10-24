import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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
const app = initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const prefix = 'payment-flow-' + Date.now();
const productId = prefix + '-product';
const couponId = prefix + '-coupon';
const downloadUrl = 'https://example.invalid/local-digital-material';
const emails: any[] = [];
const createdDocs: FirebaseFirestore.DocumentReference[] = [];
const userIds: string[] = [];
const nativeFetch = globalThis.fetch;
let buyerToken = '';
let strangerToken = '';

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === 'https://api.resend.com/emails') {
    emails.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'local-email-' + emails.length }), { status: 200 });
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error('La prueba bloqueó una llamada externa.');
  return nativeFetch(input, init);
};
const { applyPaymentToOrder } = await import('../api/_orderSync.ts');
const { default: downloadHandler } = await import('../api/get-digital-download.ts');

async function createBuyer(label: string) {
  const email = prefix + '-' + label + '@example.test';
  const password = randomBytes(24).toString('hex');
  const user = await auth.createUser({ email, password, emailVerified: true });
  userIds.push(user.uid);
  const response = await fetch('http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST +
    '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  assert.equal(response.ok, true);
  return { uid: user.uid, token: (await response.json()).idToken as string };
}
let buyerId = '';
async function createOrder(label: string, coupon = false) {
  const ref = db.collection('orders').doc(prefix + '-' + label);
  createdDocs.push(ref);
  await ref.set({
    userId: buyerId, userName: 'Comprador ficticio',
    items: [{ productId, name: 'Material ficticio', price: 100, quantity: 1, isDigital: true }],
    total: coupon ? 90 : 100, expectedTotal: coupon ? 90 : 100,
    paymentMethod: 'mercadopago', paymentStatus: 'pending', status: 'pending',
    ...(coupon ? { couponCode: prefix.toUpperCase(), couponReservationId: ref.id } : {}),
  });
  if (coupon) {
    const reservation = db.collection('couponReservations').doc(ref.id);
    createdDocs.push(reservation);
    await reservation.set({ orderId: ref.id, couponId, status: 'reserved' });
  }
  return ref;
}
function payment(orderId: string, amount: number, status = 'approved') {
  const id = prefix + '-mp-' + orderId;
  if (status === 'approved') createdDocs.push(db.collection('mpPayments').doc(id));
  return { id, status, external_reference: orderId, currency_id: 'ARS', transaction_amount: amount };
}
async function download(orderId: string, token: string) {
  const result: any = { code: 200, body: null };
  const res: any = {
    setHeader() {},
    status(code: number) { result.code = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
  await downloadHandler({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: { orderId, productId } } as any, res);
  return result;
}
let paidOrder: FirebaseFirestore.DocumentReference;

before(async () => {
  const buyer = await createBuyer('buyer');
  buyerId = buyer.uid;
  buyerToken = buyer.token;
  strangerToken = (await createBuyer('stranger')).token;
  const product = db.collection('products').doc(productId);
  const privateDownload = db.collection('productDownloads').doc(productId);
  const coupon = db.collection('coupons').doc(couponId);
  createdDocs.push(product, privateDownload, coupon);
  await product.set({ name: 'Material ficticio', price: 100, isDigital: true, isActive: true });
  await privateDownload.set({ downloadUrl });
  await coupon.set({ code: prefix.toUpperCase(), maxUses: 1, usedCount: 0, reservedCount: 1 });
  paidOrder = await createOrder('paid', true);
});
after(async () => {
  globalThis.fetch = nativeFetch;
  const batch = db.batch();
  for (const ref of new Map(createdDocs.map(ref => [ref.path, ref])).values()) batch.delete(ref);
  await batch.commit();
  await Promise.all(userIds.map(uid => auth.deleteUser(uid)));
  await deleteApp(app);
});

it('un pago aprobado consume una sola reserva y envía el correo acreditado con descarga', async () => {
  const result = await applyPaymentToOrder(paidOrder.id, payment(paidOrder.id, 90));
  assert.equal(result.paymentStatus, 'approved');
  const order = (await paidOrder.get()).data()!;
  assert.equal(order.emailSent, true);
  assert.equal(order.paymentStatus, 'approved');
  const coupon = (await db.collection('coupons').doc(couponId).get()).data()!;
  assert.equal(coupon.usedCount, 1);
  assert.equal(coupon.reservedCount, 0);
  assert.equal(emails.length, 1);
  assert.match(emails[0].html, /acreditado correctamente/);
  assert.ok(emails[0].html.includes(downloadUrl));
});
it('repetir el mismo pago no consume otro cupo ni duplica el correo', async () => {
  await applyPaymentToOrder(paidOrder.id, payment(paidOrder.id, 90));
  assert.equal(emails.length, 1);
  assert.equal((await db.collection('coupons').doc(couponId).get()).data()!.usedCount, 1);
});
it('solo el comprador de una orden aprobada recibe el enlace privado', async () => {
  const owned = await download(paidOrder.id, buyerToken);
  assert.equal(owned.code, 200);
  assert.equal(owned.body.downloadUrl, downloadUrl);
  const denied = await download(paidOrder.id, strangerToken);
  assert.equal(denied.code, 403);
  assert.equal(denied.body.downloadUrl, undefined);
});
it('un monto incorrecto no aprueba el pago ni habilita la descarga', async () => {
  const ref = await createOrder('mismatch');
  const result = await applyPaymentToOrder(ref.id, payment(ref.id, 1));
  assert.equal(result.mismatch, true);
  assert.equal((await ref.get()).data()!.paymentStatus, 'pending');
  assert.equal((await download(ref.id, buyerToken)).code, 403);
});
it('un aviso pendiente iniciado antes de una aprobación no puede sobrescribirla', async () => {
  const ref = await createOrder('concurrent');
  const prototype = Object.getPrototypeOf(ref);
  const originalGet = prototype.get;
  let unblock!: () => void;
  let readCompleted!: () => void;
  const resumed = new Promise<void>(resolve => { unblock = resolve; });
  const read = new Promise<void>(resolve => { readCompleted = resolve; });
  let intercept = true;
  prototype.get = async function (...args: any[]) {
    const snap = await originalGet.apply(this, args);
    if (this.path === ref.path && intercept) {
      intercept = false;
      readCompleted();
      await resumed;
    }
    return snap;
  };
  try {
    const delayed = applyPaymentToOrder(ref.id, payment(ref.id, 100, 'pending'));
    await read;
    await applyPaymentToOrder(ref.id, payment(ref.id, 100));
    unblock();
    assert.equal((await delayed).paymentStatus, 'approved');
    assert.equal((await ref.get()).data()!.paymentStatus, 'approved');
  } finally {
    unblock();
    prototype.get = originalGet;
  }
});
