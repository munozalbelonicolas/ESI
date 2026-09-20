/**
 * Vercel Serverless Function — Email de confirmación de compra y aviso al admin
 * ==============================================================================
 * Envía dos notificaciones usando Resend:
 * 1. Email al cliente con el resumen de su compra (y links de descarga si son productos digitales).
 * 2. Email al administrador con los datos de la venta, comprador y dirección de envío.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@esi-secundaria.com.ar';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export interface OrderEmailItem {
  name?: string;
  title?: string;
  quantity?: number;
  price?: number;
  unit_price?: number;
  isDigital?: boolean;
  downloadUrl?: string | null;
}

export interface OrderEmailData {
  orderId: string;
  userEmail: string;
  userName?: string;
  items: OrderEmailItem[];
  total: number;
  paymentMethod?: string;
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
    console.warn('[Email] RESEND_API_KEY no configurado en Vercel, salteando envío de emails');
    return { skipped: 'no RESEND_API_KEY' };
  }

  if (!order || !order.userEmail) {
    throw new Error('Datos de orden o email de comprador no especificados');
  }

  const { orderId, userEmail, userName = '', items = [], total, paymentMethod = 'mercadopago', shippingAddress, shippingMethod } = order;

  // 1. Tabla de items compartida
  const itemsHtml = items
    .map((item) => {
      const name = item.name || item.title || 'Producto';
      const qty = item.quantity || 1;
      const price = Number(item.price || item.unit_price || 0);
      const downloadLink =
        item.isDigital && item.downloadUrl
          ? `<br><a href="${item.downloadUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 4px; color: #6B2D7B; font-weight: bold; text-decoration: underline; font-size: 0.9em;">📥 Descargar material digital</a>`
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

  // 2. Email para el CLIENTE
  const customerHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF5; border: 1px solid #EAD895; border-radius: 12px; overflow: hidden;">
      <div style="background: #6B2D7B; padding: 24px; text-align: center;">
        <h1 style="color: #FFE164; margin: 0; font-size: 24px; letter-spacing: 0.5px;">ESI en Secundaria</h1>
      </div>
      <div style="padding: 24px 28px;">
        <h2 style="color: #6B2D7B; margin-top: 0;">¡Gracias por tu compra${userName ? ', ' + userName : ''}!</h2>
        <p style="color: #333; line-height: 1.5;">Tu orden <strong>#${orderId}</strong> fue registrada y procesada correctamente.</p>

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
          <p style="margin: 4px 0; color: #334155;"><strong>Email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>
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
        subject: `Confirmación de compra #${orderId} — ESI en Secundaria`,
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
          subject: `🛍️ ¡Nueva venta #${orderId}! - $${Number(total || 0).toLocaleString('es-AR')} (${userName || userEmail})`,
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

  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order } = req.body || {};
    if (!order || !order.userEmail) {
      return res.status(400).json({ error: 'Datos de orden requeridos' });
    }

    const result = await sendOrderConfirmationEmail(order);
    return res.status(200).json({ sent: true, ...result });
  } catch (error: any) {
    console.error('[Email] Error en handler:', error.message || error);
    return res.status(500).json({ error: 'Error al procesar email', detail: error.message });
  }
}
