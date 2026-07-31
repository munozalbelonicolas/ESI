/**
 * Vercel Serverless Function — Email de confirmación de compra
 * ================================================================
 * Envía un email al cliente confirmando su compra usando Resend
 * (plan gratuito: 3,000 emails/mes, 100/día).
 *
 * Se llama desde el frontend después de una compra exitosa (transferencia)
 * o desde el webhook de MP (pago aprobado).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@esi-secundaria.com.ar';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY no configurado, salteando email');
    return res.status(200).json({ skipped: 'no API key' });
  }

  try {
    const { order, type } = req.body;

    if (!order || !order.userEmail) {
      return res.status(400).json({ error: 'Datos de orden requeridos' });
    }

    const { orderId, userEmail, userName, items, total, paymentMethod } = order;

    // Generar HTML del email
    const itemsHtml = (items || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.price || 0).toLocaleString('es-AR')}</td>
        </tr>`
      )
      .join('');

    const html = `
      <div style="font-family: 'Asap Condensed', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFFDF5;">
        <div style="background: #6B2D7B; padding: 24px; text-align: center;">
          <h1 style="color: #FFE164; margin: 0;">ESI en Secundaria</h1>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #6B2D7B;">¡Gracias por tu compra${userName ? ', ' + userName : ''}!</h2>
          <p>Tu orden <strong>#${orderId}</strong> fue registrada correctamente.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="background: #FFF8E1;">
                <th style="padding: 8px; text-align: left;">Producto</th>
                <th style="padding: 8px; text-align: center;">Cantidad</th>
                <th style="padding: 8px; text-align: right;">Precio</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div style="text-align: right; font-size: 1.2em; font-weight: bold; color: #6B2D7B;">
            Total: $${Number(total || 0).toLocaleString('es-AR')}
          </div>

          <div style="margin-top: 24px; padding: 16px; background: #FFF8E1; border-radius: 8px;">
            <strong>Método de pago:</strong> ${paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia bancaria'}
            ${paymentMethod === 'transfer' ? '<br><em>Recuerda que tu pago será verificado por nuestro equipo.</em>' : ''}
          </div>

          <p style="color: #555; font-size: 0.9em; margin-top: 32px;">
            Si tenés alguna consulta, respondé a este email o escribinos por WhatsApp.<br>
            — El equipo de ESI en Secundaria
          </p>
        </div>
      </div>
    `;

    // Enviar con Resend
    const sendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `ESI en Secundaria <${FROM_EMAIL}>`,
        to: [userEmail],
        bcc: ADMIN_EMAIL ? [ADMIN_EMAIL] : [],
        subject: `Confirmación de compra #${orderId}`,
        html,
      }),
    });

    if (!sendResponse.ok) {
      const errBody = await sendResponse.text();
      console.error('[Email] Error Resend:', sendResponse.status, errBody);
      return res.status(500).json({ error: 'Error al enviar email', detail: errBody });
    }

    const result = await sendResponse.json();
    console.log('[Email] Enviado a', userEmail, 'id:', result.id);
    res.status(200).json({ sent: true, emailId: result.id });
  } catch (error: any) {
    console.error('[Email] Error:', error.message || error);
    res.status(500).json({ error: 'Error al enviar email', detail: error.message });
  }
}
