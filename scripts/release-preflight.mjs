/* global process, URL, URLSearchParams, fetch, AbortSignal, console */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { cert } from 'firebase-admin/app';

if (!process.argv.includes('--production-read-only')) throw new Error('Se requiere --production-read-only.');
if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Este informe usa lectura explícita de producción, sin emulador.');
const envFile = process.argv.find(arg => arg.startsWith('--env-file='))?.slice(11);
const env = parseEnv(readFileSync(envFile || new URL('../.env.local', import.meta.url), 'utf8'));
const projectId = env.FIREBASE_PROJECT_ID;
if (!projectId || projectId.startsWith('demo-') || env.VITE_FIREBASE_PROJECT_ID !== projectId) {
  throw new Error('El proyecto Firebase debe coincidir entre la interfaz y el servidor.');
}
try {
  const cliPath = process.argv.find(arg => arg.startsWith('--firebase-cli-module='))?.slice(22);
  let accessToken;
  if (cliPath) {
    const cliAuth = createRequire(import.meta.url)(cliPath);
    const account = cliAuth.getProjectDefaultAccount(process.cwd());
    if (!account) throw new Error('Firebase CLI no tiene una sesión disponible.');
    accessToken = (await cliAuth.getAccessToken(account.tokens.refresh_token, [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ])).access_token;
  } else {
    accessToken = (await cert({
      projectId, clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }).getAccessToken()).access_token;
  }
  const base = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
  const headers = { Authorization: 'Bearer ' + accessToken };
  const decode = value => {
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    return null;
  };
  async function list(collection, fields) {
    const docs = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ pageSize: '1000' });
      fields.forEach(field => params.append('mask.fieldPaths', field));
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(base + '/' + collection + '?' + params, { headers, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Object.assign(new Error('Lectura no autorizada'), { code: response.status });
      const body = await response.json();
      for (const document of body.documents || []) {
        const data = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
        docs.push({ id: document.name.split('/').at(-1), rawFields: document.fields || {}, data: () => data });
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
    return { docs, size: docs.length };
  }
  // All operations in this script are GET requests with explicit field masks.
  const [products, downloads, pendingOrders] = await Promise.all([
    list('products', ['name', 'isActive', 'isFree', 'isDigital', 'digitalFileUrl', 'publicCatalogReady', 'hasDigitalDownload', 'updatedAt']),
    list('productDownloads', ['downloadUrl', 'updatedAt', 'updatedBy', 'migratedAt']),
    list('orders', ['paymentStatus', 'couponCode', 'paymentMethod', 'couponReservationId']),
  ]);
  const backupOutput = process.argv.find(arg => arg.startsWith('--backup-output='))?.slice(16);
  if (backupOutput) {
    const target = resolve(backupOutput);
    const rel = relative(process.cwd(), target);
    if (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) throw new Error('Guardá el respaldo privado fuera del repositorio.');
    writeFileSync(target, JSON.stringify({
      date: new Date().toISOString(), projectId, readOnly: true,
      products: products.docs.map(doc => ({ id: doc.id, fields: doc.rawFields })),
      productDownloads: downloads.docs.map(doc => ({ id: doc.id, fields: doc.rawFields })),
    }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    console.log('Respaldo de enlaces guardado fuera del repositorio; no compartirlo públicamente.');
  }
  const privateIds = new Set(downloads.docs.map(doc => doc.id));
  const inventory = products.docs.map(doc => {
    const p = doc.data();
    const url = p.digitalFileUrl;
    let legacyUrl = 'none';
    if (typeof url === 'string' && url.trim()) {
      try { legacyUrl = new URL(url).protocol === 'https:' ? 'valid-https' : 'invalid'; }
      catch { legacyUrl = 'invalid'; }
    } else if (url != null && typeof url !== 'string') legacyUrl = 'invalid';
    return {
      id: doc.id, name: p.name || '', active: p.isActive === true, free: p.isFree === true,
      digital: p.isDigital === true, legacyUrl, privateDownload: privateIds.has(doc.id),
      catalogReady: p.publicCatalogReady === true,
    };
  });
  let mp = { credentialConfigured: !!env.MP_ACCESS_TOKEN, valid: false, mode: 'unknown' };
  if (env.MP_ACCESS_TOKEN) {
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN },
      signal: AbortSignal.timeout(15000),
    });
    mp = {
      credentialConfigured: true, valid: response.ok,
      mode: env.MP_ACCESS_TOKEN.startsWith('TEST-') ? 'test' : 'production',
    };
  }
  const report = {
    date: new Date().toISOString(), projectId, readOnly: true,
    totalProducts: inventory.length,
    linksToMigrate: inventory.filter(p => p.legacyUrl === 'valid-https').length,
    invalidLinks: inventory.filter(p => p.legacyUrl === 'invalid'),
    activePaidDigital: inventory.filter(p => p.active && p.digital && !p.free).length,
    activeFree: inventory.filter(p => p.active && p.free).length,
    pendingOrders: pendingOrders.docs.filter(doc => doc.data().paymentStatus === 'pending').length,
    pendingCouponOrders: pendingOrders.docs.filter(doc => doc.data().paymentStatus === 'pending' && !!doc.data().couponCode).map(doc => ({
      orderId: doc.id, paymentMethod: doc.data().paymentMethod,
      reserved: !!doc.data().couponReservationId,
    })),
    mercadoPago: mp,
    localWebhookSecretConfigured: !!env.MP_WEBHOOK_SECRET,
    localEmailConfigured: !!env.RESEND_API_KEY,
    localCronSecretConfigured: !!env.CRON_SECRET,
    products: inventory,
  };
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ ...report, products: undefined }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: 'No se pudo completar la lectura de preparación.', code: error?.code || 'unknown' }));
  process.exitCode = 1;
}
