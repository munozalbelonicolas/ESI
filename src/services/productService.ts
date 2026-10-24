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
import { auth, db } from '../config/firebase';
import type { Product, ProductFormData } from '../types/product';
import { slugify } from '../utils/validators';
import { SAMPLE_PRODUCTS } from '../data/sampleData';

const COLLECTION = 'products';
const PAGE_SIZE = 12;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function publicProduct(id: string, data: Record<string, any>): Product {
  const { digitalFileUrl, ...safeData } = data;
  return {
    ...safeData,
    id,
    hasDigitalDownload: safeData.hasDigitalDownload === true || (typeof digitalFileUrl === 'string' && !!digitalFileUrl.trim()),
  } as Product;
}

async function productDownloadRequest(path: string, method: string, body?: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Iniciá sesión como administrador');
  const response = await fetch(`${API_BASE}/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'No se pudo actualizar el archivo digital privado');
  }
  return response.json();
}

export async function getPrivateProductDownload(productId: string): Promise<string> {
  const data = await productDownloadRequest(`admin-product-download?productId=${encodeURIComponent(productId)}`, 'GET');
  return data.downloadUrl || '';
}

export async function migrateLegacyProductDownloads(dryRun = false): Promise<{
  migrated: number;
  cleaned: number;
  skippedInvalid: number;
  productsToMarkReady: number;
  productsToKeepHidden: number;
  linksToMigrate?: { productId: string; productName: string; displayUrl: string }[];
  invalidProducts?: { productId: string; productName: string }[];
  previewTruncated?: boolean;
  invalidProductsTruncated?: boolean;
}> {
  return productDownloadRequest('admin-migrate-product-downloads', 'POST', { dryRun });
}

async function savePrivateProductDownload(productId: string, url: string | null | undefined): Promise<void> {
  if (url?.trim()) {
    await productDownloadRequest('admin-product-download', 'POST', { productId, downloadUrl: url.trim() });
  } else {
    await productDownloadRequest('admin-product-download', 'DELETE', { productId });
  }
}

// Fallback sample products with generated IDs
const FALLBACK_PRODUCTS: Product[] = SAMPLE_PRODUCTS.map((p, i) => ({
  ...p,
  id: `sample-prod-${i + 1}`,
  slug: slugify(p.name),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}));

function fallbackProducts(category?: string): Product[] {
  if (!import.meta.env.DEV) return [];
  return category ? FALLBACK_PRODUCTS.filter((p) => p.category === category) : FALLBACK_PRODUCTS;
}

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
      where('publicCatalogReady', '==', true),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    if (category) {
      q = query(
        collection(db, COLLECTION),
        where('isActive', '==', true),
        where('publicCatalogReady', '==', true),
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
      const filtered = fallbackProducts(category);
      const res = { products: filtered, lastVisible: null };
      if (!lastDoc) productsCache.set(cacheKey, { timestamp: Date.now(), data: res });
      return res;
    }
    const products = snap.docs.map((d) => publicProduct(d.id, d.data()));
    const lastVisible = snap.docs[snap.docs.length - 1] || null;

    const result = { products, lastVisible };
    if (!lastDoc) {
      productsCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }
    return result;
  } catch (err) {
    console.warn('[productService] Falta índice en Firestore, intentando consulta alternativa:', err);
    try {
      let qAlt = query(collection(db, COLLECTION), where('isActive', '==', true), where('publicCatalogReady', '==', true));
      if (category) {
        qAlt = query(collection(db, COLLECTION), where('isActive', '==', true), where('publicCatalogReady', '==', true), where('category', '==', category));
      }
      const snapAlt = await getDocs(qAlt);
      if (!snapAlt.empty) {
        const prodsAlt = snapAlt.docs.map((d) => publicProduct(d.id, d.data()));
        prodsAlt.sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
        const resAlt = { products: prodsAlt.slice(0, PAGE_SIZE), lastVisible: null };
        if (!lastDoc) productsCache.set(cacheKey, { timestamp: Date.now(), data: resAlt });
        return resAlt;
      }
    } catch {
      // continuar a muestra
    }

    const filtered = fallbackProducts(category);
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
    if (snap.empty) return fallbackProducts();
    return snap.docs.map((d) => publicProduct(d.id, d.data()));
  } catch (err) {
    console.warn('[productService] Error en getAllProducts ordenado, probando consulta simple:', err);
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      if (snap.empty) return fallbackProducts();
      const prods = snap.docs.map((d) => publicProduct(d.id, d.data()));
      return prods.sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
    } catch {
      return fallbackProducts();
    }
  }
}

/**
 * Obtiene un producto por su slug.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  // 1. Buscar en caché de productos ya cargados
  for (const entry of productsCache.values()) {
    const found = entry.data.products.find((p) => p.slug === slug);
    if (found) return found;
  }
  for (const entry of featuredCache.values()) {
    const found = entry.data.find((p) => p.slug === slug);
    if (found) return found;
  }

  try {
    const q = query(
      collection(db, COLLECTION),
      where('slug', '==', slug),
      where('isActive', '==', true),
      where('publicCatalogReady', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return publicProduct(d.id, d.data());
    }
  } catch {
    // fallback
  }
  return fallbackProducts().find((p) => p.slug === slug) || null;
}

/**
 * Obtiene un producto por su ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  // 1. Buscar en caché de productos ya cargados
  for (const entry of productsCache.values()) {
    const found = entry.data.products.find((p) => p.id === id);
    if (found) return found;
  }
  for (const entry of featuredCache.values()) {
    const found = entry.data.find((p) => p.id === id);
    if (found) return found;
  }

  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (snap.exists()) return publicProduct(snap.id, snap.data() || {});
  } catch {
    // fallback
  }
  return fallbackProducts().find((p) => p.id === id) || null;
}

/**
 * Crea un nuevo producto (admin).
 */
export async function createProduct(data: ProductFormData): Promise<string> {
  clearProductsCache();
  const { digitalFileUrl, ...publicData } = data;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...publicData,
    hasDigitalDownload: !!digitalFileUrl?.trim(),
    publicCatalogReady: true,
    slug: slugify(publicData.name),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await savePrivateProductDownload(ref.id, digitalFileUrl);
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
  const { digitalFileUrl, ...publicData } = data;
  await updateDoc(doc(db, COLLECTION, id), {
    ...publicData,
    hasDigitalDownload: !!digitalFileUrl?.trim(),
    // Mantenerlo oculto hasta que la API privada elimine cualquier URL legado.
    publicCatalogReady: false,
    slug: publicData.name ? slugify(publicData.name) : undefined,
    updatedAt: Timestamp.now(),
  });
  if (Object.prototype.hasOwnProperty.call(data, 'digitalFileUrl')) {
    await savePrivateProductDownload(id, digitalFileUrl);
  }
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
      where('publicCatalogReady', '==', true),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const prods = snap.docs.map((d) => publicProduct(d.id, d.data()));
      featuredCache.set(cacheKey, { timestamp: Date.now(), data: prods });
      return prods;
    }
  } catch {
    // fallback
  }
  const fallback = fallbackProducts().slice(0, count);
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
