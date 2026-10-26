/**
 * Vercel Serverless Function — Email de confirmación de compra y aviso al admin
 * ==============================================================================
 * Envía dos notificaciones usando Resend:
 * 1. Email al cliente con el resumen de su compra (y links de descarga si son productos digitales).
 * 2. Email al administrador con los datos de la venta, comprador y dirección de envío.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getVerifiedUserEmail, requireUser } from './_admin.js';
import { isValidDocId, readBody } from './_cors.js';

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Solo se permiten enlaces https; cualquier otra cosa se descarta. */
const safeUrl = (v: unknown): string => {
  try {
    const u = new URL(String(v ?? ''));
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@esiensecundaria.com.ar';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SITE_URL = (process.env.VITE_SITE_URL || 'https://esiensecundaria.com.ar').replace(/\/$/, '');

export interface OrderEmailItem {
  productId?: string;
  name?: string;
  title?: string;
  quantity?: number;
  price?: number;
  unit_price?: number;
  isDigital?: boolean;
}

export interface OrderEmailData {
  orderId: string;
  userId: string;
  userName?: string;
  items: OrderEmailItem[];
  total: number;
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  shippingAddress?: {
    street?: string;
    city?: string;
    province?: string;
    zipCode?: string;
  } | null;
  shippingMethod?: string;
}

export async function sendOrderConfirmationEmail(order: OrderEmailData) {
  if (!RESEND_API_KEY) {
    // Throw so callers keep emailSent=false and a later retry can succeed
    // once the provider credentials are configured.
    throw new Error('RESEND_API_KEY no configurado en Vercel');
  }

  if (!order || !order.userId) {
    throw new Error('Datos de orden o email de comprador no especificados');
  }

  const verifiedEmail = await getVerifiedUserEmail(order.userId);
  if (!verifiedEmail) throw new Error('La cuenta compradora no tiene un email verificado');

  const { orderId: rawOrderId, userName: rawUserName = '', items = [], total, paymentMethod = 'mercadopago', shippingAddress: rawShipping, shippingMethod: rawShippingMethod } = order;

  // Valores crudos (asunto/destinatario) y versiones escapadas para el HTML
  const userEmail = verifiedEmail;
  const orderId = esc(rawOrderId);
  const userName = esc(rawUserName);
  const shippingMethod = esc(rawShippingMethod);
  const shippingAddress = rawShipping
    ? {
        street: esc(rawShipping.street),
        city: esc(rawShipping.city),
        province: esc(rawShipping.province),
        zipCode: esc(rawShipping.zipCode),
      }
    : null;
  const emailForHtml = esc(userEmail);

  const isApproved = order.paymentStatus === 'approved';
  const db = getAdminDb();

  // 1. Tabla de items compartida con resolución segura de archivos digitales
  const itemsWithUrls = await Promise.all(
    items.map(async (item) => {
      let dl = '';
      let canonicalDigital = false;
      let canonicalName = item.name || item.title || 'Producto';
      let canonicalPrice = Number(item.price || item.unit_price || 0);
      if (item.productId) {
        try {
          const productSnap = await db.collection('products').doc(item.productId).get();
          const product = productSnap.data();
          canonicalDigital = !!productSnap.exists && product?.isDigital === true;
          if (product) {
            canonicalName = String(product.name || canonicalName);
            canonicalPrice = Number(product.price || canonicalPrice);
          }
          if (isApproved && canonicalDigital) {
            const privateSnap = await db.collection('productDownloads').doc(item.productId).get();
            if (privateSnap.exists && privateSnap.data()?.downloadUrl) {
              dl = safeUrl(privateSnap.data()?.downloadUrl);
            }
          }
        } catch (err) {
          console.warn(`[Email] Error resolviendo producto ${item.productId}:`, err);
        }
      }
      return { ...item, name: canonicalName, price: canonicalPrice, isDigital: canonicalDigital, resolvedDownloadUrl: dl };
    })
  );

  const itemsHtml = itemsWithUrls
    .map((item) => {
      const name = esc(item.name || item.title || 'Producto');
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price || item.unit_price || 0);
      const dl = item.resolvedDownloadUrl;
      const downloadLink =
        isApproved && dl
          ? `<br><a href="${esc(dl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 4px; color: #6B2D7B; font-weight: bold; text-decoration: underline; font-size: 0.9em;">📥 Descargar material digital</a>`
          : '';

      return `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee;">
            <strong>${name}</strong>${downloadLink}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: center;">${qty}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: right;">$${price.toLocaleString('es-AR')}</td>
        </tr>`;
    })
    .join('');

  const shippingInfoHtml = shippingAddress
    ? `
      <div style="margin-top: 16px; padding: 14px; background: #FFF8E1; border-radius: 8px; font-size: 0.95em;">
        <strong style="color: #6B2D7B;">📦 Datos de Entrega:</strong><br>
        <strong>Método:</strong> ${shippingMethod || 'Envío a domicilio'}<br>
        <strong>Dirección:</strong> ${shippingAddress.street || ''}, ${shippingAddress.city || ''}, ${shippingAddress.province || ''} (CP: ${shippingAddress.zipCode || ''})
      </div>`
    : '';

  // Mensaje personalizado según si el pago ya está acreditado o está pendiente de validación
  const customerIntroText = isApproved
    ? `Tu orden <strong>#${orderId}</strong> fue registrada y el pago fue <strong>acreditado correctamente</strong>. A continuación encontrás el detalle y los enlaces de descarga de tus materiales digitales.`
    : `Tu orden <strong>#${orderId}</strong> fue registrada y tu comprobante de pago está en proceso de verificación por nuestro equipo. <em>Una vez confirmada la acreditación bancaria te enviaremos un nuevo correo con los enlaces de descarga de tus materiales digitales y podrás acceder a ellos desde tu cuenta en Mis Pedidos.</em>`;

  // 2. Email para el CLIENTE
  const customerHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF5; border: 1px solid #EAD895; border-radius: 12px; overflow: hidden;">
      <div style="background: #6B2D7B; padding: 24px; text-align: center;">
        <h1 style="color: #FFE164; margin: 0; font-size: 24px; letter-spacing: 0.5px;">ESI en Secundaria</h1>
      </div>
      <div style="padding: 24px 28px;">
        <h2 style="color: #6B2D7B; margin-top: 0;">${isApproved ? '¡Gracias por tu compra' : '¡Pedido recibido'}${userName ? ', ' + userName : ''}!</h2>
        <p style="color: #333; line-height: 1.5;">${customerIntroText}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #FFF8E1; border-bottom: 2px solid #EAD895;">
              <th style="padding: 10px 8px; text-align: left; color: #6B2D7B;">Producto</th>
              <th style="padding: 10px 8px; text-align: center; color: #6B2D7B;">Cant.</th>
              <th style="padding: 10px 8px; text-align: right; color: #6B2D7B;">Precio</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align: right; font-size: 1.25em; font-weight: bold; color: #6B2D7B; margin-top: 10px;">
          Total: $${Number(total || 0).toLocaleString('es-AR')}
        </div>

        <div style="margin-top: 20px; padding: 14px; background: #F3E8F4; border-radius: 8px; font-size: 0.95em;">
          <strong>Método de pago:</strong> ${paymentMethod === 'mercadopago' ? 'Mercado Pago (Acreditado)' : 'Transferencia bancaria'}
          ${paymentMethod === 'transfer' ? '<br><em style="color: #555;">Recordá que si adjuntaste tu comprobante, será validado por nuestro equipo a la brevedad.</em>' : ''}
        </div>

        ${shippingInfoHtml}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/mis-ordenes" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #6B2D7B; color: #FFE164; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">Ver mis pedidos y descargar mi material</a>
        </div>

        <p style="color: #666; font-size: 0.9em; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; line-height: 1.5;">
          Si tenés alguna consulta o inconveniente, podés responder a este email o comunicarte con nosotros por WhatsApp.<br>
          — <strong>El equipo de ESI en Secundaria</strong>
        </p>
      </div>
    </div>
  `;

  // 3. Email para el ADMINISTRADOR
  const adminHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">
      <div style="background: #1E293B; padding: 20px; text-align: center;">
        <span style="background: #10B981; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">
          Nueva Venta Realizada
        </span>
        <h1 style="color: #F8FAFC; margin: 12px 0 0; font-size: 22px;">Orden #${orderId}</h1>
      </div>
      <div style="padding: 24px;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0F172A; font-size: 16px;">Datos del Comprador</h3>
          <p style="margin: 4px 0; color: #334155;"><strong>Nombre:</strong> ${userName || 'No informado'}</p>
          <p style="margin: 4px 0; color: #334155;"><strong>Email:</strong> <a href="mailto:${emailForHtml}">${emailForHtml}</a></p>
          <p style="margin: 4px 0; color: #334155;"><strong>Medio de pago:</strong> ${paymentMethod === 'mercadopago' ? 'Mercado Pago (Aprobado)' : 'Transferencia Bancaria'}</p>
          <p style="margin: 4px 0; color: #334155;"><strong>Monto Total:</strong> <span style="color: #059669; font-weight: bold; font-size: 1.1em;">$${Number(total || 0).toLocaleString('es-AR')}</span></p>
        </div>

        ${shippingInfoHtml}

        <h3 style="color: #0F172A; margin: 24px 0 8px;">Detalle de Productos</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Cant.</th>
              <th style="padding: 8px; text-align: right;">Precio</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <p style="color: #64748B; font-size: 0.85em; margin-top: 24px; text-align: center;">
          Aviso automático del sistema de ventas de ESI en Secundaria.
        </p>
      </div>
    </div>
  `;

  const results: { customerEmailId?: string; adminEmailId?: string } = {};

  // Enviar al cliente
  try {
    const custRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `ESI en Secundaria <${FROM_EMAIL}>`,
        to: [userEmail],
        subject: `Confirmación de compra #${rawOrderId} — ESI en Secundaria`,
        html: customerHtml,
      }),
    });

    if (custRes.ok) {
      const data = await custRes.json();
      results.customerEmailId = data.id;
      console.log('[Email] Confirmación enviada al cliente:', userEmail, 'ID:', data.id);
    } else {
      const err = await custRes.text();
      console.error('[Email] Error enviando al cliente:', custRes.status, err);
    }
  } catch (err: any) {
    console.error('[Email] Error en fetch cliente:', err.message || err);
  }

  // Enviar al administrador
  if (ADMIN_EMAIL) {
    try {
      const adminRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `ESI en Secundaria <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `🛍️ ¡Nueva venta #${rawOrderId}! - $${Number(total || 0).toLocaleString('es-AR')} (${String(rawUserName || userEmail).replace(/[\r\n]/g, ' ')})`,
          html: adminHtml,
        }),
      });

      if (adminRes.ok) {
        const data = await adminRes.json();
        results.adminEmailId = data.id;
        console.log('[Email] Aviso de venta enviado al admin:', ADMIN_EMAIL, 'ID:', data.id);
      } else {
        const err = await adminRes.text();
        console.error('[Email] Error enviando al admin:', adminRes.status, err);
      }
    } catch (err: any) {
      console.error('[Email] Error en fetch admin:', err.message || err);
    }
  } else {
    console.warn('[Email] ADMIN_EMAIL no configurado; no se envió aviso al administrador');
  }

  // Do not let callers mark the order as emailed when Resend rejected (or
  // failed) the customer's message. The order can then be retried later.
  if (!results.customerEmailId) {
    throw new Error('No se pudo enviar el correo de confirmación al cliente');
  }

  return results;
}

/**
 * Endpoint: el cliente autenticado pide el email de su propia orden (por orderId).
 * El contenido se arma SIEMPRE desde Firestore; nunca desde el cuerpo de la petición.
 * Solo se envía una vez por orden (flag emailSent). Las órdenes de Mercado Pago
 * requieren pago aprobado (ese caso lo dispara el webhook/verificación).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const body = readBody(req);
    const orderId = body.orderId ?? body.order?.orderId;
    if (!isValidDocId(orderId)) {
      return res.status(400).json({ error: 'orderId requerido' });
    }

    const orderRef = getAdminDb().collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Orden no encontrada' });

    const o = snap.data() || {};
    if (o.userId !== user.uid && !user.isAdmin) return res.status(403).json({ error: 'No autorizado' });
    if (o.userId !== user.uid) {
      if (!user.isAdmin) return res.status(403).json({ error: 'No autorizado' });
    } else if (!user.emailVerified || !user.email) {
      return res.status(403).json({ error: 'Verificá el email de tu cuenta antes de recibir notificaciones' });
    }

    // CASO 1: Pago ya aprobado (Mercado Pago o Transferencia confirmada por Admin)
    if (o.paymentStatus === 'approved') {
      const claimed = await getAdminDb().runTransaction(async (transaction) => {
        const freshOrder = await transaction.get(orderRef);
        if (!freshOrder.exists) throw new Error('ORDER_NOT_FOUND');
        const fresh = freshOrder.data() || {};
        if (fresh.userId !== user.uid && !user.isAdmin) throw new Error('NOT_OWNER');
        if (fresh.paymentStatus !== 'approved') throw new Error('NOT_APPROVED');
        if (fresh.emailSent) return false;
        transaction.update(orderRef, { emailSent: true, updatedAt: new Date() });
        return true;
      });
      if (!claimed) return res.status(200).json({ sent: false, reason: 'already_sent' });
      try {
        await sendOrderConfirmationEmail({
          orderId,
          userId: o.userId,
          userName: o.userName,
          items: o.items || [],
          total: o.total || 0,
          paymentMethod: o.paymentMethod,
          paymentStatus: 'approved',
          shippingAddress: o.shippingAddress || null,
          shippingMethod: o.shippingMethod || '',
        });
      } catch (e) {
        await orderRef.update({ emailSent: false });
        throw e;
      }
      return res.status(200).json({ sent: true, type: 'approved_confirmation' });
    }

    // CASO 2: Pago pendiente por Transferencia (envía acuse de recibo pero NUNCA enlaces de descarga)
    if (o.paymentMethod === 'transfer' && o.paymentStatus === 'pending') {
      const db = getAdminDb();
      const limitRef = db.collection('emailDispatchLimits').doc(o.userId);
      let claimed = false;
      await db.runTransaction(async (transaction) => {
        claimed = false;
        const freshOrder = await transaction.get(orderRef);
        const limitSnap = await transaction.get(limitRef);
        if (!freshOrder.exists) throw new Error('ORDER_NOT_FOUND');
        const fresh = freshOrder.data() || {};
        if (fresh.userId !== user.uid && !user.isAdmin) throw new Error('NOT_OWNER');
        if (fresh.paymentMethod !== 'transfer' || fresh.paymentStatus !== 'pending') throw new Error('NOT_PENDING_TRANSFER');
        if (fresh.pendingNoticeSent) return;

        const now = Date.now();
        const current = limitSnap.data() || {};
        const windowStart = Number(current.windowStart || 0);
        const count = now - windowStart < 60 * 60 * 1000 ? Number(current.count || 0) : 0;
        if (count >= 3) throw new Error('EMAIL_RATE_LIMIT');

        transaction.update(orderRef, { pendingNoticeSent: true, updatedAt: new Date() });
        transaction.set(limitRef, {
          windowStart: count ? windowStart : now,
          count: count + 1,
          updatedAt: new Date(),
        });
        claimed = true;
      });
      if (!claimed) return res.status(200).json({ sent: false, reason: 'already_sent' });

      try {
        await sendOrderConfirmationEmail({
          orderId,
          userId: o.userId,
          userName: o.userName,
          items: o.items || [],
          total: o.total || 0,
          paymentMethod: 'transfer',
          paymentStatus: 'pending',
          shippingAddress: o.shippingAddress || null,
          shippingMethod: o.shippingMethod || '',
        });
      } catch (e) {
        await orderRef.update({ pendingNoticeSent: false });
        throw e;
      }
      return res.status(200).json({ sent: true, type: 'transfer_pending_notice' });
    }

    // CASO 3: Cualquier otro método sin pago aprobado
    return res.status(409).json({ error: 'El pago aún no está acreditado' });
  } catch (error: any) {
    console.error('[Email] Error en handler:', error.message || error);
    if (error?.message === 'EMAIL_RATE_LIMIT') return res.status(429).json({ error: 'Demasiados avisos; intentá nuevamente más tarde' });
    if (error?.message === 'NOT_OWNER') return res.status(403).json({ error: 'No autorizado' });
    if (error?.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Orden no encontrada' });
    if (error?.message === 'NOT_APPROVED') return res.status(409).json({ error: 'El pago aún no está acreditado' });
    if (error?.message === 'NOT_PENDING_TRANSFER') return res.status(409).json({ error: 'La transferencia no está pendiente' });
    return res.status(500).json({ error: 'Error al procesar email' });
  }
}
