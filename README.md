# ESI en Secundaria — Sitio Web (Landing + Tienda + Blog)

Marca educativa argentina de Educación Sexual Integral (ESI) para docentes de nivel secundario. Sitio completo con tienda, blog, panel de administración y pasarela de pago.

---

## 🎨 Identidad Visual
- **Marca**: ESI en Secundaria
- **Color primario**: Amarillo vibrante (`#ffe406`)
- **Color secundario**: Púrpura/Violeta (`#690477`)
- **Tipografía de títulos**: *Asap Condensed*
- **Tipografía de cuerpo**: *Balsamiq Sans*
- **Tono de voz**: Cálido, cercano, profesional y enfocado en docentes.

---

## Stack Técnico

| Capa             | Tecnología                                      |
|------------------|-------------------------------------------------|
| Frontend         | React 19 + Vite 8 + TypeScript 6                |
| Estilos          | CSS Custom Properties (Design System propio)    |
| Auth + DB        | Firebase Authentication + Cloud Firestore       |
| Imágenes         | Cloudinary (plan gratuito 25GB) o Base64 fallback|
| Pagos            | Mercado Pago (vía Vercel Serverless Function)   |
| Notificaciones   | Resend (email transaccional, 3K/mes gratis)     |
| Analytics        | Google Analytics 4 (GA4)                        |
| Hosting          | Vercel (gratuito) o Firebase Hosting           |
| PWA              | manifest.json + Service Worker                  |

**Plan Firebase Spark (gratuito):** Auth, Firestore e imágenes funcionan sin Blaze. Las serverless functions se hospedan en Vercel (no requieren Blaze).

---

## Estructura del Proyecto

```
Tienda/
├── api/                        # Serverless Functions (Vercel)
│   ├── create-mp-preference.ts # Crear preferencia de Mercado Pago
│   ├── mp-webhook.ts           # Webhook IPN de MP → actualiza Firestore
│   ├── notify-purchase.ts      # Email de confirmación de compra
│   └── notify-low-stock.ts     # Email de aviso de stock bajo (cron 9am)
├── src/
│   ├── components/
│   │   ├── admin/              # Layout del panel admin
│   │   ├── auth/               # ProtectedRoute (cliente/admin)
│   │   ├── layout/             # Navbar, Footer, WhatsAppButton
│   │   └── shop/               # ProductCard
│   ├── config/
│   │   ├── analytics.ts        # GA4 con 7 eventos estructurados
│   │   ├── firebase.ts         # Config de Firebase (env vars)
│   │   ├── mercadopago.ts      # SDK JS de MP
│   │   └── site.ts             # Config del sitio, categorías, provincias
│   ├── context/
│   │   ├── AuthContext.tsx     # Estado de auth + isEmailVerified + isAdmin
│   │   └── CartContext.tsx     # Carrito persistente (localStorage)
│   ├── data/
│   │   └── sampleData.ts       # Datos de ejemplo (productos, posts, cupones)
│   ├── pages/
│   │   ├── admin/              # Dashboard, Productos, Blog, Órdenes, Cupones
│   │   ├── HomePage.tsx        # Landing con hero, sobre nosotros, CTA
│   │   ├── ShopPage.tsx        # Catálogo con filtros
│   │   ├── ProductPage.tsx     # Detalle de producto
│   │   ├── CartPage.tsx        # Carrito
│   │   ├── CheckoutPage.tsx    # Checkout 3 pasos (envío, pago, confirmar)
│   │   ├── BlogPage.tsx        # Listado de blog
│   │   ├── BlogPostPage.tsx    # Detalle de entrada
│   │   ├── LoginPage.tsx       # Login
│   │   ├── RegisterPage.tsx    # Registro
│   │   ├── MyOrdersPage.tsx    # Órdenes del cliente
│   │   ├── ProfilePage.tsx      # Perfil del cliente
│   │   ├── CheckoutSuccessPage.tsx
│   ├── services/
│   │   ├── authService.ts       # Registro, login, reset, verificación
│   │   ├── productService.ts    # CRUD productos + fallback a sample data
│   │   ├── blogService.ts       # CRUD blog + paginación
│   │   ├── orderService.ts      # CRUD órdenes
│   │   ├── couponService.ts     # Validación y CRUD cupones
│   │   ├── paymentService.ts    # MP preference + email confirmación
│   │   ├── shippingService.ts   # Simulador Correo Argentino (desacoplado)
│   │   ├── storageService.ts    # Cloudinary upload
│   │   └── subscriptionHook.ts  # Hook para envío futuro de material
│   ├── types/                   # Interfaces TypeScript
│   ├── utils/
│   │   ├── seedData.ts          # Sembrar datos en Firestore
│   │   ├── validators.ts        # Validaciones + slugify
│   │   ├── formatDate.ts
│   │   └── formatPrice.ts
│   ├── index.css                # Design System completo
│   ├── App.tsx                  # Rutas
│   └── main.tsx
├── public/                       # Assets estáticos (logo.webp, iconos PWA)
├── firestore.rules               # Reglas de seguridad Firestore
├── storage.rules                  # Reglas de seguridad Cloud Storage
├── firebase.json                 # Config Firebase Hosting + Firestore
├── vercel.json                  # Config Vercel (crons, rewrites, headers)
├── eslint.config.js             # ESLint (flat config)
├── .prettierrc                  # Prettier
└── .env.example                 # Template de variables de entorno
```

---

## Cómo correr el proyecto localmente

### Requisitos
- Node.js 20+
- npm 10+

### Pasos

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Copiar .env.example a .env y completar
cp .env.example .env
# Editar .env con las credenciales reales

# 3. Correr en desarrollo
npm run dev
# Abre en http://localhost:5173

# 4. Build de producción
npm run build
# Output en dist/
```

---

## Variables de Entorno

### Frontend (.env) — públicas, van en Vercel como "VITE_*"

| Variable                        | Descripción                          |
|---------------------------------|--------------------------------------|
| `VITE_FIREBASE_API_KEY`         | API Key de Firebase                  |
| `VITE_FIREBASE_AUTH_DOMAIN`     | Auth domain                          |
| `VITE_FIREBASE_PROJECT_ID`      | Project ID                           |
| `VITE_FIREBASE_STORAGE_BUCKET`  | Storage bucket                       |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID                      |
| `VITE_FIREBASE_APP_ID`          | App ID                               |
| `VITE_CLOUDINARY_CLOUD_NAME`    | Cloud name de Cloudinary             |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Upload preset (unsigned)            |
| `VITE_MP_PUBLIC_KEY`            | Public key de Mercado Pago           |
| `VITE_GA_MEASUREMENT_ID`        | ID de GA4 (G-XXXXXXX)                |
| `VITE_WHATSAPP_NUMBER`          | Número de WhatsApp (sin +)           |
| `VITE_SITE_URL`                 | URL del sitio (ej: https://esi-secundaria.com) |
| `VITE_API_BASE_URL`             | Vacío si se sirve desde Vercel       |

### Servidor (Vercel Dashboard > Settings > Environment Variables) — secretas

| Variable                     | Descripción                                    |
|------------------------------|------------------------------------------------|
| `MP_ACCESS_TOKEN`            | Access Token de Mercado Pago (server-side)     |
| `RESEND_API_KEY`             | API Key de Resend para emails                  |
| `FROM_EMAIL`                 | Email remitente (ej: noreply@esi-secundaria.com) |
| `ADMIN_EMAIL`                | Email del admin para notificaciones            |
| `FIREBASE_PROJECT_ID`        | Project ID de Firebase                         |
| `FIREBASE_CLIENT_EMAIL`      | Email del service account                      |
| `FIREBASE_PRIVATE_KEY`       | Private key (con \n escapados)                 |
| `LOW_STOCK_THRESHOLD`        | Umbral de stock bajo (default: 5)              |

---

## Deploy

### Opción A: Vercel (recomendada)

1. Conectar el repo GitHub a Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Configurar todas las env vars en Vercel Dashboard
6. `git push` → deploy automático

Las 4 API routes en `/api/` se deployan automáticamente como serverless functions.

### Opción B: Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

Nota: Las API routes no funcionan en Firebase Hosting. Usar Vercel.

---

## Qué está implementado

- [x] Landing page con hero, sobre nosotros, categorías, productos destacados, blog
- [x] Tienda con catálogo, filtros por categoría, productos pagos y gratuitos
- [x] Detalle de producto con carrito persistente (localStorage)
- [x] Checkout de 3 pasos (envío → pago → confirmar)
- [x] Mercado Pago (serverless function en Vercel)
- [x] Transferencia con subida de comprobante (Cloudinary)
- [x] Cupones de descuento (validación, porcentaje/monto fijo)
- [x] Cotizador de envío (simulador Correo Argentino, desacoplado)
- [x] Blog con listado paginado y detalle
- [x] Firebase Auth con verificación de email obligatoria
- [x] Roles cliente/admin con ProtectedRoute
- [x] Panel admin: Dashboard con métricas (Chart.js), CRUD productos, CRUD blog, CRUD cupones, gestión de órdenes
- [x] Email de confirmación de compra (Resend vía Vercel)
- [x] Aviso de stock bajo (cron diario vía Vercel)
- [x] Google Analytics 4 con 7 eventos estructurados
- [x] Botón de WhatsApp flotante con tracking
- [x] PWA: manifest.json + service worker
- [x] Imágenes WEBP (logo 69% más liviano)
- [x] Design System con CSS Custom Properties
- [x] Reglas de seguridad Firestore y Storage
- [x] Datos de ejemplo (seed) para probar
- [x] ESLint + Prettier configurados

## Qué falta (pendientes del cliente)

- [ ] Cuenta real de Mercado Pago → obtener `MP_ACCESS_TOKEN` y `VITE_MP_PUBLIC_KEY`
- [ ] Cuenta de Resend → obtener `RESEND_API_KEY` y configurar dominio de FROM_EMAIL
- [ ] Cuenta de Firebase del cliente → configurar `VITE_FIREBASE_*` y service account
- [ ] Número de WhatsApp definitivo
- [ ] Comprar dominio y apuntar a Vercel (o Firebase Hosting)
- [ ] Credenciales de Correo Argentino si se quiere reemplazar el simulador de envío

---

## Mantenimiento

### Diagnóstico de errores
```bash
npm run lint       # Verificar código
npm run build      # Verificar build
npm run dev        # Correr en desarrollo
```

### Sembrar datos de ejemplo
Desde la consola del navegador:
```js
import { seedInitialData } from './utils/seedData';
await seedInitialData();
```

### Convertir un usuario a admin
En Firestore, editar el documento `users/{uid}` y cambiar `role` de `customer` a `admin`.

### Reglas de Firestore
Las reglas están en `firestore.rules`. Deployar con:
```bash
firebase deploy --only firestore:rules
```

### Linting y formato
```bash
npm run lint        # Verificar
npm run lint:fix    # Corregir auto
npm run format      # Formatear con Prettier
```

---

## Jira
Proyecto: **ESI** en nilo-tech.atlassian.net
Épicas: 13 (9 completadas, 4 en curso)
Tareas: 54 (29 completadas, 6 en curso, 8 pendientes)
