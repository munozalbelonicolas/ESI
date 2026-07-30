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

/**
 * Obtiene productos activos con paginación. Fallback a muestra si falla Firestore.
 */
export async function getProducts(
  category?: string,
  lastDoc?: DocumentSnapshot
): Promise<{ products: Product[]; lastVisible: DocumentSnapshot | null }> {
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
      return { products: filtered, lastVisible: null };
    }
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
    const lastVisible = snap.docs[snap.docs.length - 1] || null;

    return { products, lastVisible };
  } catch (err) {
    console.warn('[productService] Firestore no disponible, usando datos de muestra:', err);
    const filtered = category
      ? FALLBACK_PRODUCTS.filter((p) => p.category === category)
      : FALLBACK_PRODUCTS;
    return { products: filtered, lastVisible: null };
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
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Obtiene productos destacados.
 */
export async function getFeaturedProducts(count: number = 8): Promise<Product[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
    }
  } catch {
    // fallback
  }
  return FALLBACK_PRODUCTS.slice(0, count);
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
