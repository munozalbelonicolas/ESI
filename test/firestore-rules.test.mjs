/* global process, fetch */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-esi-local';
if (projectId !== 'demo-esi-local') {
  throw new Error('Estas pruebas solo se permiten con el proyecto demo-esi-local.');
}

const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
const [emulatorHost, emulatorPort] = emulatorAddress.split(':');
const fixturePrefix = 'rules-test-' + Date.now();
const cleanId = fixturePrefix + '-clean';
const legacyId = fixturePrefix + '-legacy';
const app = initializeApp({
  apiKey: 'demo-key',
  projectId,
  appId: '1:123:web:' + fixturePrefix,
}, fixturePrefix);
const db = getFirestore(app);
connectFirestoreEmulator(db, emulatorHost, Number(emulatorPort));

async function seedAsEmulatorOwner(id, fields) {
  const url = 'http://' + emulatorAddress + '/v1/projects/' + projectId +
    '/databases/(default)/documents/products?documentId=' + id;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  assert.equal(response.ok, true, 'No se pudo preparar el fixture ' + id + ': ' + await response.text());
}

before(async () => {
  await seedAsEmulatorOwner(cleanId, {
    name: { stringValue: 'Producto público de prueba' },
    isActive: { booleanValue: true },
    publicCatalogReady: { booleanValue: true },
  });
  await seedAsEmulatorOwner(legacyId, {
    name: { stringValue: 'Producto legado de prueba' },
    isActive: { booleanValue: true },
    publicCatalogReady: { booleanValue: false },
    digitalFileUrl: { stringValue: 'https://example.invalid/privado?token=FAKE' },
  });
});

after(async () => {
  for (const id of [cleanId, legacyId]) {
    await fetch('http://' + emulatorAddress + '/v1/projects/' + projectId +
      '/databases/(default)/documents/products/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner' },
    });
  }
  await deleteApp(app);
});

describe('Reglas Firestore para el catálogo público', () => {
  it('permite leer un producto activo marcado como listo', async () => {
    const snapshot = await getDoc(doc(db, 'products', cleanId));
    assert.equal(snapshot.exists(), true);
  });

  it('deniega la lectura directa de un producto con enlace legado', async () => {
    await assert.rejects(
      getDoc(doc(db, 'products', legacyId)),
      (error) => error.code === 'permission-denied'
    );
  });

  it('deniega la consulta pública si no garantiza el marcador de seguridad', async () => {
    await assert.rejects(
      getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
      (error) => error.code === 'permission-denied'
    );
  });

  it('la consulta del catálogo devuelve solo productos activos listos', async () => {
    const snapshot = await getDocs(query(
      collection(db, 'products'),
      where('isActive', '==', true),
      where('publicCatalogReady', '==', true)
    ));
    assert.deepEqual(snapshot.docs.map((product) => product.id), [cleanId]);
  });

  it('deniega que un visitante escriba productos o altere el marcador', async () => {
    await assert.rejects(
      setDoc(doc(db, 'products', fixturePrefix + '-forbidden'), {
        isActive: true,
        publicCatalogReady: true,
        digitalFileUrl: 'https://example.invalid/leak',
      }),
      (error) => error.code === 'permission-denied'
    );
  });

  it('deniega crear pedidos directamente desde el navegador, para no saltar la reserva', async () => {
    await assert.rejects(
      setDoc(doc(db, 'orders', fixturePrefix + '-order'), {
        userId: 'visitor', items: [{ productId: 'p1', quantity: 1 }],
        status: 'pending', paymentStatus: 'pending', mpPaymentId: null,
      }),
      (error) => error.code === 'permission-denied'
    );
  });

  it('deniega listar cupones desde el navegador, aunque estén activos', async () => {
    await assert.rejects(
      getDocs(query(collection(db, 'coupons'), where('isActive', '==', true))),
      (error) => error.code === 'permission-denied'
    );
  });

  it('deniega leer o modificar reservas de cupones desde el navegador', async () => {
    await assert.rejects(getDoc(doc(db, 'couponReservations', fixturePrefix)),
      (error) => error.code === 'permission-denied');
    await assert.rejects(setDoc(doc(db, 'couponReservations', fixturePrefix), { status: 'consumed' }),
      (error) => error.code === 'permission-denied');
  });
});

describe('Reglas Firestore para comprobantes de transferencia', () => {
  const ownerUid = fixturePrefix + '-owner';
  const base = 'http://' + emulatorAddress + '/v1/projects/' + projectId + '/databases/(default)/documents';
  // El emulador acepta tokens sin firmar: permite probar las reglas como un usuario autenticado.
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const userToken = (uid) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({
    sub: uid, user_id: uid, aud: projectId, iss: 'https://securetoken.google.com/' + projectId,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: { sign_in_provider: 'password' },
  }) + '.';
  const str = (value) => ({ stringValue: value });
  const orders = {
    pending: { paymentMethod: 'transfer', paymentStatus: 'pending', status: 'pending' },
    approved: { paymentMethod: 'transfer', paymentStatus: 'approved', status: 'paid' },
    mp: { paymentMethod: 'mercadopago', paymentStatus: 'pending', status: 'pending' },
  };
  const orderId = (label) => fixturePrefix + '-proof-' + label;

  async function writeAs(token, path, fields, mask) {
    const query = mask ? '?' + mask.map((field) => 'updateMask.fieldPaths=' + field).join('&') : '';
    return fetch(base + '/' + path + query, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  }
  const proof = (label) => ({ orderId: str(orderId(label)), imageData: str('data:image/png;base64,AAAA') });

  before(async () => {
    for (const [label, data] of Object.entries(orders)) {
      const fields = { userId: str(ownerUid) };
      for (const [key, value] of Object.entries(data)) fields[key] = str(value);
      const response = await writeAs('owner', 'orders/' + orderId(label), fields);
      assert.equal(response.ok, true, await response.text());
    }
  });

  after(async () => {
    for (const label of Object.keys(orders)) {
      for (const path of ['orders/', 'transferProofs/']) {
        await fetch(base + '/' + path + orderId(label), { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
      }
    }
  });

  it('el titular adjunta el comprobante de su transferencia pendiente', async () => {
    const response = await writeAs(userToken(ownerUid), 'transferProofs/' + orderId('pending'), proof('pending'));
    assert.equal(response.status, 200, await response.text());
    const order = await writeAs(userToken(ownerUid), 'orders/' + orderId('pending'), { transferProofUrl: str('firestore://x') }, ['transferProofUrl']);
    assert.equal(order.status, 200, await order.text());
  });

  it('no permite cambiar el comprobante de un pedido ya aprobado ni de uno de Mercado Pago', async () => {
    for (const label of ['approved', 'mp']) {
      const response = await writeAs(userToken(ownerUid), 'transferProofs/' + orderId(label), proof(label));
      assert.equal(response.status, 403, label);
      const order = await writeAs(userToken(ownerUid), 'orders/' + orderId(label), { transferProofUrl: str('firestore://x') }, ['transferProofUrl']);
      assert.equal(order.status, 403, label);
    }
  });

  it('otro usuario no puede adjuntar comprobantes a un pedido ajeno', async () => {
    const response = await writeAs(userToken(fixturePrefix + '-intruder'), 'transferProofs/' + orderId('pending'), proof('pending'));
    assert.equal(response.status, 403);
  });
});
