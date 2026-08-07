import { defineConfig, loadEnv } from 'vite';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      {
        name: 'dev-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/create-mp-preference', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Method not allowed' }));
            }

            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });

            req.on('end', async () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const mpAccessToken = env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;

                if (!mpAccessToken) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'MP_ACCESS_TOKEN no configurado en .env.local' }));
                }

                const mp = new MercadoPagoConfig({ accessToken: mpAccessToken });
                const { orderId, items, payerEmail, payer_email, shippingCost, shipping_cost, discount } = body;

                const email = payerEmail || payer_email || 'test_user_1234567@testuser.com';
                const finalShippingCost = Number(shippingCost || shipping_cost || 0);
                const rawDiscount = Number(discount || 0);

                const rawItems = items || [];
                const subtotal = rawItems.reduce(
                  (acc: number, i: any) =>
                    acc + Number(i.unit_price || i.price || 0) * Number(i.quantity || 1),
                  0
                );

                const discountAmount = Math.min(rawDiscount, subtotal);
                const discountFactor = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

                const mpItems: Array<{
                  id: string;
                  title: string;
                  quantity: number;
                  unit_price: number;
                  currency_id: string;
                  picture_url?: string;
                }> = rawItems.map((item: any) => {
                  const origPrice = Number(item.unit_price || item.price || 0);
                  const finalUnitPrice = Math.max(
                    0.01,
                    Math.round(origPrice * discountFactor * 100) / 100
                  );

                  return {
                    id: String(item.productId || item.id || ''),
                    title: String(item.name || item.title || 'Producto').slice(0, 256),
                    quantity: Number(item.quantity || 1),
                    unit_price: finalUnitPrice,
                    currency_id: 'ARS',
                    picture_url: item.image || item.picture_url || '',
                  };
                });

                if (finalShippingCost > 0) {
                  mpItems.push({
                    id: 'shipping',
                    title: 'Envío',
                    quantity: 1,
                    unit_price: finalShippingCost,
                    currency_id: 'ARS',
                    picture_url: '',
                  });
                }

                const rawSiteUrl = env.VITE_SITE_URL || '';
                const isLocalhost = !rawSiteUrl || rawSiteUrl.includes('localhost') || rawSiteUrl.includes('127.0.0.1');
                const baseUrl = isLocalhost ? 'http://localhost:5173' : rawSiteUrl;

                const preferenceClient = new Preference(mp);

                const prefBody: any = {
                  items: mpItems,
                  payer: { email },
                  metadata: { orderId: orderId || '' },
                  back_urls: {
                    success: `${baseUrl}/checkout/exito`,
                    failure: `${baseUrl}/carrito`,
                    pending: `${baseUrl}/mis-ordenes`,
                  },
                  statement_descriptor: 'ESI Secundaria',
                };

                if (!isLocalhost) {
                  prefBody.auto_return = 'approved';
                }

                const result = await preferenceClient.create({
                  body: prefBody,
                });

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    preferenceId: result.id,
                    initPoint: result.init_point,
                    sandboxInitPoint: result.sandbox_init_point,
                  })
                );
              } catch (err: any) {
                console.error('[Dev API] Error creando preferencia Mercado Pago:', err.message || err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: 'Error al crear preferencia de Mercado Pago',
                    detail: err.message || String(err),
                  })
                );
              }
            });
          });
        },
      },
    ],
  };
});
