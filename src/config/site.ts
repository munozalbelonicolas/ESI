import esiLogo from '../assets/logo.svg';

export const SITE_CONFIG = {
  name: 'ESI en Secundaria',
  tagline: 'Recursos de Educación Sexual Integral para nivel secundario',
  description:
    'Materiales, cuadernillos, juegos y recursos didácticos de ESI para docentes de secundaria. Todo lo que necesitás para abordar la ESI en el aula con seguridad y profesionalismo.',
  email: 'esiensecundaria@gmail.com',
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER || '5491100000000',
  logo: esiLogo,
  socialMedia: {
    instagram: 'https://www.instagram.com/esiensecundaria/',
    facebook: '',
    tiktok: '',
  },
  currency: 'ARS',
  currencySymbol: '$',
  locale: 'es-AR',
  lowStockThreshold: 5,
} as const;

export const NAV_LINKS = [
  { label: 'Inicio', path: '/' },
  { label: 'Tienda', path: '/tienda' },
  { label: 'Blog', path: '/blog' },
] as const;

export const ADMIN_NAV_LINKS = [
  { label: 'Dashboard', path: '/admin', icon: 'dashboard' },
  { label: 'Productos', path: '/admin/productos', icon: 'products' },
  { label: 'Blog', path: '/admin/blog', icon: 'blog' },
  { label: 'Órdenes', path: '/admin/ordenes', icon: 'orders' },
  { label: 'Cupones', path: '/admin/cupones', icon: 'coupons' },
  { label: 'Envíos', path: '/admin/envios', icon: 'shipping' },
  { label: 'Datos Bancarios', path: '/admin/banco', icon: 'bank' },
] as const;

export const PROVINCES = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const;
