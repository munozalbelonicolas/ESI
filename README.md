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
- Java 21 y Firebase CLI para ejecutar Firestore Emulator
- Vercel CLI para ejecutar las funciones reales de `/api`

### Pasos

No uses credenciales de producción para desarrollar. La aplicación exige el emulador cuando corre en modo desarrollo.

1. Instalar dependencias y copiar la configuración local segura:

   ```powershell
   npm install --legacy-peer-deps
   Copy-Item .env.development.local.example .env.development.local
   ```

2. Iniciar Auth, Firestore, Storage y Emulator UI en una terminal:

   ```powershell
   firebase emulators:start --only auth,firestore,storage --project demo-esi-local
   ```

3. En otra terminal, apuntar Firebase Admin al emulador y levantar Vercel local:

   ```powershell
   $env:GCLOUD_PROJECT = 'demo-esi-local'
   $env:FIREBASE_PROJECT_ID = 'demo-esi-local'
   $env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
   $env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
   vercel dev --listen 3000
   ```

4. Abrir `http://localhost:3000` y Emulator UI en `http://127.0.0.1:4000`. Crear ahí usuarios/documentos de prueba. Solo para pagos, configurar en esa terminal credenciales de prueba de Mercado Pago; no agregar `RESEND_API_KEY` para evitar envíos reales.

5. Para compilar la versión de producción sin desplegar:

   ```powershell
   npm run build
   ```

Las funciones reales de `/api` se prueban con `vercel dev`; no uses la antigua ruta de pago integrada en Vite. El modo local requiere un `VITE_FIREBASE_PROJECT_ID` que empiece con `demo-` y la variable explícita `VITE_USE_FIREBASE_EMULATOR=true`.

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
| `VITE_SITE_URL`                 | URL del sitio (ej: https://esiensecundaria.com.ar) |
| `VITE_API_BASE_URL`             | Vacío si se sirve desde Vercel       |

### Servidor (Vercel Dashboard > Settings > Environment Variables) — secretas

| Variable                     | Descripción                                    |
|------------------------------|------------------------------------------------|
| `MP_ACCESS_TOKEN`            | Access Token de Mercado Pago (server-side)     |
| `MP_WEBHOOK_SECRET`           | Secreto de firma de notificaciones de Mercado Pago (obligatorio) |
| `RESEND_API_KEY`             | API Key de Resend para emails                  |
| `FROM_EMAIL`                 | Email remitente (ej: noreply@esiensecundaria.com.ar) |
| `ADMIN_EMAIL`                | Email del admin para notificaciones            |
| `FIREBASE_PROJECT_ID`        | Project ID de Firebase                         |
| `FIREBASE_CLIENT_EMAIL`      | Email del service account                      |
| `FIREBASE_PRIVATE_KEY`       | Private key (con \n escapados)                 |
| `LOW_STOCK_THRESHOLD`        | Umbral de stock bajo (default: 5)              |

Las variables `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST` se configuran solo en la terminal local según los pasos anteriores. Nunca las agregues al entorno de producción.

---

## Deploy

### Opción A: Vercel (recomendada)

1. Conectar el repo GitHub a Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Configurar todas las env vars en Vercel Dashboard
6. `git push` → deploy automático

Las API routes en `/api/` se deployan automáticamente como serverless functions.

### Migración segura de enlaces digitales existentes

Los enlaces antiguos guardados en `products.digitalFileUrl` deben migrarse antes de publicar las nuevas reglas de Firestore. La regla pública bloquea los documentos que todavía contengan ese campo.

1. Configurar `MP_WEBHOOK_SECRET` en Vercel antes de publicar el nuevo webhook. Si falta, el endpoint responde 503 y no procesa pagos.
2. Publicar la aplicación/API, manteniendo temporalmente las reglas de Firestore actuales.
3. Iniciar sesión como administrador y abrir **Admin > Productos**. Usar **Proteger enlaces antiguos** y confirmar el resultado. Corregir enlaces inválidos desde el editor de cada producto hasta que la migración indique cero pendientes.
4. Confirmar que los enlaces estén en `productDownloads` y que ningún documento de `products` conserve `digitalFileUrl`.
5. Publicar `firestore.rules` con `firebase deploy --only firestore:rules`.

No publicar las reglas nuevas antes de completar la migración: la tienda bloqueará las consultas públicas mientras quede algún documento de producto con el campo legado. Los permisos de origen de los archivos también deben impedir el acceso público directo a materiales pagos; ocultar una URL no revoca enlaces que ya se compartieron.

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
