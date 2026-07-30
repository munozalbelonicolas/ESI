import { Timestamp } from 'firebase/firestore';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice: number | null;
  isFree: boolean;
  category: string;
  images: string[];
  stock: number; // -1 = digital/ilimitado
  isDigital: boolean;
  digitalFileUrl: string | null;
  weightGrams?: number;
  customShippingPrice?: number | null;
  isActive: boolean;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProductFormData {
  name: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice: number | null;
  isFree: boolean;
  category: string;
  images: string[];
  stock: number;
  isDigital: boolean;
  digitalFileUrl: string | null;
  weightGrams?: number;
  customShippingPrice?: number | null;
  isActive: boolean;
  tags: string[];
}

export const PRODUCT_CATEGORIES = [
  'Caja de herramientas',
  'Cuadernillos',
  'Cursos asincrónicos',
  'Promociones',
  'Calendario y Efemérides',
  'Juegos',
  'Agenda',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
