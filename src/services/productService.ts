import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Product, ProductFormData } from '../types/product';
import { slugify } from '../utils/validators';
import { SAMPLE_PRODUCTS } from '../data/sampleData';

const COLLECTION = 'products';
const PAGE_SIZE = 12;

// Fallback sample products with generated IDs
const FALLBACK_PRODUCTS: Product[] = SAMPLE_PRODUCTS.map((p, i) => ({
  ...p,
  id: `sample-prod-${i + 1}`,
  slug: slugify(p.name),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}));

// Memory cache with 5-minute TTL
const CACHE_TTL = 5 * 60 * 1000;
const productsCache = new Map<string, { timestamp: number; data: { products: Product[]; lastVisible: DocumentSnapshot | null } }>();
const featuredCache = new Map<string, { timestamp: number; data: Product[] }>();

export function clearProductsCache(): void {
  productsCache.clear();
  featuredCache.clear();
}

/**
 * Obtiene productos activos con paginación y caché en memoria. Fallback a muestra si falla Firestore.
 */
export async function getProducts(
  category?: string,
  lastDoc?: DocumentSnapshot
): Promise<{ products: Product[]; lastVisible: DocumentSnapshot | null }> {
  const cacheKey = category || '__ALL__';
  
  // Usar caché solo para la primera página (sin lastDoc)
  if (!lastDoc) {
    const cached = productsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    let q = query(
      collection(db, COLLECTION),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    if (category) {
      q = query(
        collection(db, COLLECTION),
        where('isActive', '==', true),
        where('category', '==', category),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      const filtered = category
        ? FALLBACK_PRODUCTS.filter((p) => p.category === category)
        : FALLBACK_PRODUCTS;
      const res = { products: filtered, lastVisible: null };
      if (!lastDoc) productsCache.set(cacheKey, { timestamp: Date.now(), data: res });
      return res;
    }
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
    const lastVisible = snap.docs[snap.docs.length - 1] || null;

    const result = { products, lastVisible };
    if (!lastDoc) {
      productsCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }
    return result;
  } catch (err) {
    console.warn('[productService] Firestore no disponible, usando datos de muestra:', err);
    const filtered = category
      ? FALLBACK_PRODUCTS.filter((p) => p.category === category)
      : FALLBACK_PRODUCTS;
    const res = { products: filtered, lastVisible: null };
    if (!lastDoc) productsCache.set(cacheKey, { timestamp: Date.now(), data: res });
    return res;
  }
}

/**
 * Obtiene TODOS los productos.
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) return FALLBACK_PRODUCTS;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  } catch {
    return FALLBACK_PRODUCTS;
  }
}

/**
 * Obtiene un producto por su slug.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const q = query(collection(db, COLLECTION), where('slug', '==', slug), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as Product;
    }
  } catch {
    // fallback
  }
  return FALLBACK_PRODUCTS.find((p) => p.slug === slug) || null;
}

/**
 * Obtiene un producto por su ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    // fallback
  }
  return FALLBACK_PRODUCTS.find((p) => p.id === id) || null;
}

/**
 * Crea un nuevo producto (admin).
 */
export async function createProduct(data: ProductFormData): Promise<string> {
  clearProductsCache();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    slug: slugify(data.name),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

/**
 * Actualiza un producto existente (admin).
 */
export async function updateProduct(
  id: string,
  data: Partial<ProductFormData>
): Promise<void> {
  clearProductsCache();
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    slug: data.name ? slugify(data.name) : undefined,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Elimina un producto (admin).
 */
export async function deleteProduct(id: string): Promise<void> {
  clearProductsCache();
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Obtiene productos destacados con caché en memoria.
 */
export async function getFeaturedProducts(count: number = 8): Promise<Product[]> {
  const cacheKey = `featured_${count}`;
  const cached = featuredCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const prods = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
      featuredCache.set(cacheKey, { timestamp: Date.now(), data: prods });
      return prods;
    }
  } catch {
    // fallback
  }
  const fallback = FALLBACK_PRODUCTS.slice(0, count);
  featuredCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
  return fallback;
}

/**
 * Actualiza el stock de un producto tras una compra.
 */
export async function decrementStock(
  productId: string,
  quantity: number
): Promise<void> {
  const product = await getProductById(productId);
  if (!product || product.stock === -1) return;
  const newStock = Math.max(0, product.stock - quantity);
  try {
    await updateDoc(doc(db, COLLECTION, productId), {
      stock: newStock,
      updatedAt: Timestamp.now(),
    });
  } catch {
    // local fallback silent
  }
}
