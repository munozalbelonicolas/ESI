# ESI en Secundaria — Plataforma Web Completa (Landing + Tienda + Blog)

Sitio web oficial y tienda e-commerce para la marca **ESI en Secundaria**, enfocada en brindar recursos educativos de Educación Sexual Integral para docentes de nivel secundario en Argentina.

---

## 🎨 Identidad Visual
- **Marca**: ESI en Secundaria
- **Color primario**: Amarillo cálido (`#FFE164`)
- **Color secundario**: Púrpura profesional (`#6B2D7B`)
- **Tipografía de títulos**: *Asap Condensed*
- **Tipografía de cuerpo**: *Balsamiq Sans*
- **Tono de voz**: Cálido, cercano, profesional y enfocado en docentes.

---

## 🚀 Características Principales

### 🌐 Frontend (Público)
- **Landing Page**: Hero dinámico, propuesta de valor, grilla de categorías, productos destacados, sección "Quiénes somos" con estadísticas, preview del blog y CTA final.
- **Tienda**: Catálogo interactivo con filtrado por categorías, insignias (Gratis, % OFF, Sin Stock, Digital), vista de detalle con galería de imágenes, selector de cantidad y notas de productos digitales.
- **Carrito de compras**: Persistente en `localStorage` (sin necesidad de escribir en Firestore hasta comprar).
- **Checkout multi-paso**:
  1. **Envío**: Calculador de envíos con Correo Argentino (módulo simulador desacoplado). Omisión automática si todos los items son digitales.
  2. **Pago**: Integración con Mercado Pago y opción de transferencia bancaria con carga de comprobante. Sistema de cupones de descuento.
  3. **Confirmación**: Resumen y registro de la orden.
- **Blog**: Listado de publicaciones con etiquetas, fecha y vista de artículo individual con contenido enriquecido.
- **Autenticación**: Registro con verificación por email, inicio de sesión y gestión de perfil/pedidos.
- **Boton flotante de WhatsApp**: Con tracking de eventos de Google Analytics 4.
- **PWA**: Soporte para instalación como aplicación web en dispositivos móviles.

### 🛡️ Panel de Administración (`/admin`)
- **Dashboard**: Métricas de ingresos totales, contador de órdenes pagadas, gráfico interactivo de ventas mensuales (Chart.js) y alertas de productos con bajo stock.
- **Gestor de Productos**: CRUD completo (Crear, Editar, Eliminar) con toggle para producto gratis/digital/activo.
- **Gestor del Blog**: Publicación y edición de notas con editor HTML y etiquetas.
- **Gestor de Órdenes**: Filtrado por estado, actualización de estado de pedido y pago en línea, y visualización de comprobantes de transferencia.
- **Gestor de Cupones**: Creación de cupones con descuento porcentual o fijo, fecha de vencimiento y límites de uso.

---

## 🛠️ Tecnologías

- **Core**: React 18 + TypeScript + Vite
- **Estilos**: CSS Vanilla con CSS Custom Properties (Design System)
- **Backend / BaaS**: Firebase (Authentication, Firestore, Storage, Hosting)
- **Pagos**: Mercado Pago SDK + Cloud Functions
- **Notificaciones**: React Hot Toast
- **Gráficos**: Chart.js + react-chartjs-2
- **Iconos**: React Icons (Feather / FontAwesome)

---

## 📦 Instalación y Desarrollo Local

1. **Clonar e instalar dependencias**:
   ```bash
   cd Tienda
   npm install
   ```

2. **Configurar variables de entorno**:
   Copiar `.env.example` a `.env` y completar con las llaves de Firebase y Mercado Pago:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

4. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## ⚙️ Estructura del Proyecto

```
src/
├── components/
│   ├── admin/          # Componentes y estilos del panel admin
│   ├── auth/           # Rutas protegidas y guardias de autenticación
│   ├── layout/         # Navbar, Footer, WhatsApp button
│   └── shop/           # Tarjeta de producto y grilla
├── config/             # Configuración de Firebase, GA4, Mercado Pago, Sitio
├── context/            # AuthContext y CartContext
├── pages/              # Páginas públicas y admin
│   └── admin/          # Páginas de administración (Dashboard, Productos, Blog, Órdenes, Cupones)
├── services/           # Capa de servicios (Auth, Productos, Blog, Órdenes, Cupones, Envíos, Pagos, Storage, Subscripciones)
├── types/              # Definiciones de TypeScript (Product, Blog, Order, User, Coupon)
└── utils/              # Formateadores de precio/fecha, validadores y datos semilla (seed)
```

---

## 🔐 Seguridad y Reglas de Firestore
El archivo `firestore.rules` garantiza que:
- Los productos, publicaciones de blog y cupones son de lectura pública.
- Solo los usuarios con rol `admin` en la colección `users` pueden crear/modificar/eliminar productos, blog, cupones y cambiar estados de órdenes.
- Las órdenes son visibles únicamente por su comprador o por un administrador.
