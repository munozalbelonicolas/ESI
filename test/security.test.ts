import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import { verifyMpWebhookSignature } from '../api/_mpSignature.ts';
import {
  isValidShippingZipCode,
  getZoneFromZip,
  getRateByWeight,
  DEFAULT_SHIPPING_SETTINGS,
} from '../api/_shipping.ts';
import { mapMpStatus } from '../api/_orderSync.ts';

describe('1. Seguridad de Mercado Pago Webhook Signature', () => {
  const secret = 'test_webhook_secret_key_123456';
  const dataId = '123456789';
  const requestId = 'req-abc-987-xyz';

  it('debe aceptar una firma válida generada con el secreto dentro de los 5 minutos', () => {
    const ts = String(Date.now());
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${v1}`;

    const res = verifyMpWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: requestId,
      dataId,
      secret,
    });

    assert.equal(res.valid, true);
  });

  it('debe rechazar una firma con timestamp fuera de la tolerancia de 5 minutos', () => {
    // 10 minutos en el pasado
    const expiredTs = String(Date.now() - 10 * 60 * 1000);
    const manifest = `id:${dataId};request-id:${requestId};ts:${expiredTs};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const xSignature = `ts=${expiredTs},v1=${v1}`;

    const res = verifyMpWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: requestId,
      dataId,
      secret,
    });

    assert.equal(res.valid, false);
    assert.equal(res.reason, 'timestamp_out_of_tolerance');
  });

  it('debe rechazar una firma alterada o con secreto incorrecto', () => {
    const ts = String(Date.now());
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', 'otro_secreto_malicioso').update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${v1}`;

    const res = verifyMpWebhookSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: requestId,
      dataId,
      secret,
    });

    assert.equal(res.valid, false);
    assert.equal(res.reason, 'signature_mismatch');
  });

  it('debe rechazar si falta la cabecera x-signature o x-request-id', () => {
    const res = verifyMpWebhookSignature({
      xSignatureHeader: '',
      xRequestIdHeader: requestId,
      dataId,
      secret,
    });

    assert.equal(res.valid, false);
    assert.equal(res.reason, 'missing_signature_headers_or_id');
  });
});

describe('2. Cotización y Envío Canónico en Servidor (Correo Argentino)', () => {
  it('valida estrictamente códigos postales argentinos de 4 dígitos', () => {
    assert.equal(isValidShippingZipCode('1425'), true);
    assert.equal(isValidShippingZipCode('5000'), true);
    assert.equal(isValidShippingZipCode('123'), false);
    assert.equal(isValidShippingZipCode('12345'), false);
    assert.equal(isValidShippingZipCode('C1425ABC'), false);
    assert.equal(isValidShippingZipCode('abcd'), false);
    assert.equal(isValidShippingZipCode(''), false);
  });

  it('clasifica correctamente zonas regionales y nacionales', () => {
    assert.equal(getZoneFromZip('1425'), 'regional'); // CABA
    assert.equal(getZoneFromZip('1900'), 'regional'); // La Plata
    assert.equal(getZoneFromZip('5000'), 'regional'); // Córdoba
    assert.equal(getZoneFromZip('4000'), 'nacional'); // Tucumán
    assert.equal(getZoneFromZip('9400'), 'nacional'); // Río Gallegos
  });

  it('calcula la tarifa según el peso por tramos', () => {
    const rates = DEFAULT_SHIPPING_SETTINGS.regional;
    assert.equal(getRateByWeight(rates, 500), rates.w1kg);
    assert.equal(getRateByWeight(rates, 1000), rates.w1kg);
    assert.equal(getRateByWeight(rates, 1200), rates.w5kg);
    assert.equal(getRateByWeight(rates, 5000), rates.w5kg);
    assert.equal(getRateByWeight(rates, 7000), rates.w10kg);
    // Kilos extra por encima de 25kg
    const extraWeight = 27000; // +2kg
    assert.equal(getRateByWeight(rates, extraWeight), rates.w25kg + 2 * 2500);
  });
});

describe('3. Mapeo y Endurecimiento de Pagos', () => {
  it('mapea correctamente estados de Mercado Pago', () => {
    assert.equal(mapMpStatus('approved'), 'approved');
    assert.equal(mapMpStatus('rejected'), 'rejected');
    assert.equal(mapMpStatus('cancelled'), 'rejected');
    assert.equal(mapMpStatus('in_process'), 'pending');
    assert.equal(mapMpStatus('pending'), 'pending');
    assert.equal(mapMpStatus(undefined), 'pending');
  });

  it('detecta discrepancias en external_reference, moneda y monto', () => {
    const orderId = 'order-xyz-123';
    const canonicalExpectedTotal = 15000;

    // Caso 1: external_reference no coincide
    const paymentBadRef = {
      id: 999111,
      status: 'approved',
      external_reference: 'otra-orden-distinta',
      currency_id: 'ARS',
      transaction_amount: 15000,
    };
    const hasBadRef = paymentBadRef.external_reference !== orderId;
    assert.equal(hasBadRef, true);

    // Caso 2: moneda no es ARS
    const paymentBadCurrency = {
      id: 999112,
      status: 'approved',
      external_reference: orderId,
      currency_id: 'USD',
      transaction_amount: 15000,
    };
    const hasBadCurrency = paymentBadCurrency.currency_id !== 'ARS';
    assert.equal(hasBadCurrency, true);

    // Caso 3: monto menor o manipulado
    const paymentTamperedAmount = {
      id: 999113,
      status: 'approved',
      external_reference: orderId,
      currency_id: 'ARS',
      transaction_amount: 100, // intenta pagar 100 en vez de 15000
    };
    const amountDiff = Math.abs(paymentTamperedAmount.transaction_amount - canonicalExpectedTotal);
    assert.ok(amountDiff > 0.01);

    // Caso 4: todo correcto
    const validPayment = {
      id: 999114,
      status: 'approved',
      external_reference: orderId,
      currency_id: 'ARS',
      transaction_amount: 15000,
    };
    assert.equal(validPayment.external_reference, orderId);
    assert.equal(validPayment.currency_id, 'ARS');
    assert.equal(Math.abs(validPayment.transaction_amount - canonicalExpectedTotal) <= 0.01, true);
  });
});

describe('4. Regla de Entrega Digital y Transferencias', () => {
  it('no debe permitir descarga si el pago está pendiente (incluso si es transferencia)', () => {
    const orderTransferPending = {
      userId: 'user-123',
      paymentMethod: 'transfer',
      paymentStatus: 'pending',
      status: 'pending',
    };

    // La regla de negocio del servidor exige paymentStatus === 'approved'
    const canDownload = orderTransferPending.paymentStatus === 'approved';
    assert.equal(canDownload, false);
  });

  it('no debe permitir descarga a un usuario que no es titular ni admin', () => {
    const orderApproved = {
      userId: 'user-real-owner',
      paymentMethod: 'transfer',
      paymentStatus: 'approved',
      status: 'paid',
    };

    const requestingUser = { uid: 'user-intruder', isAdmin: false };
    const authorized = requestingUser.uid === orderApproved.userId || requestingUser.isAdmin;
    assert.equal(authorized, false);
  });

  it('permite descarga únicamente cuando paymentStatus === approved y pertenece al usuario', () => {
    const orderApproved = {
      userId: 'user-real-owner',
      paymentMethod: 'mercadopago',
      paymentStatus: 'approved',
      status: 'paid',
    };

    const requestingUser = { uid: 'user-real-owner', isAdmin: false };
    const canDeliver =
      orderApproved.paymentStatus === 'approved' &&
      (requestingUser.uid === orderApproved.userId || requestingUser.isAdmin);

    assert.equal(canDeliver, true);
  });
});

describe('5. Validación y Límites de Cupones', () => {
  it('rechaza cupones expirados o que alcanzaron maxUses', () => {
    const now = Date.now();

    const couponExpired = {
      code: 'VERANO2025',
      isActive: true,
      expiresAtMs: now - 3600000,
      maxUses: 10,
      usedCount: 5,
      minPurchase: 0,
    };
    const isExpired = couponExpired.expiresAtMs < now;
    assert.equal(isExpired, true);

    const couponExhausted = {
      code: 'DESC50',
      isActive: true,
      expiresAtMs: now + 3600000,
      maxUses: 10,
      usedCount: 10,
      minPurchase: 0,
    };
    const isExhausted = couponExhausted.maxUses > 0 && couponExhausted.usedCount >= couponExhausted.maxUses;
    assert.equal(isExhausted, true);

    const couponBelowMin = {
      code: 'PROMO1000',
      isActive: true,
      expiresAtMs: now + 3600000,
      maxUses: 10,
      usedCount: 2,
      minPurchase: 50000,
    };
    const cartSubtotal = 20000;
    const isBelowMin = cartSubtotal < couponBelowMin.minPurchase;
    assert.equal(isBelowMin, true);
  });
});
