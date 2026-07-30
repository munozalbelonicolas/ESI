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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { BlogPost, BlogPostFormData } from '../types/blog';
import { slugify } from '../utils/validators';
import { SAMPLE_POSTS } from '../data/sampleData';

const COLLECTION = 'blogPosts';

const FALLBACK_POSTS: BlogPost[] = SAMPLE_POSTS.map((p, i) => ({
  ...p,
  id: `sample-post-${i + 1}`,
  slug: slugify(p.title),
  author: 'ESI en Secundaria',
  publishedAt: Timestamp.now(),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}));

/**
 * Obtiene posts publicados. Fallback a datos de muestra si falla Firestore.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BlogPost);
    }
  } catch (err) {
    console.warn('[blogService] Firestore no disponible, usando datos de muestra:', err);
  }
  return FALLBACK_POSTS;
}

/**
 * Obtiene todos los posts (admin).
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BlogPost);
    }
  } catch {
    // fallback
  }
  return FALLBACK_POSTS;
}

/**
 * Obtiene un post por su slug.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const q = query(collection(db, COLLECTION), where('slug', '==', slug), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as BlogPost;
    }
  } catch {
    // fallback
  }
  return FALLBACK_POSTS.find((p) => p.slug === slug) || null;
}

/**
 * Obtiene un post por su ID.
 */
export async function getPostById(id: string): Promise<BlogPost | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as BlogPost;
  } catch {
    // fallback
  }
  return FALLBACK_POSTS.find((p) => p.id === id) || null;
}

/**
 * Crea un nuevo post.
 */
export async function createPost(data: BlogPostFormData): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    slug: slugify(data.title),
    author: 'ESI en Secundaria',
    publishedAt: data.isPublished ? Timestamp.now() : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

/**
 * Actualiza un post existente.
 */
export async function updatePost(
  id: string,
  data: Partial<BlogPostFormData>
): Promise<void> {
  const updates: any = {
    ...data,
    updatedAt: Timestamp.now(),
  };
  if (data.title) {
    updates.slug = slugify(data.title);
  }
  if (data.isPublished) {
    updates.publishedAt = Timestamp.now();
  }
  await updateDoc(doc(db, COLLECTION, id), updates);
}

/**
 * Elimina un post.
 */
export async function deletePost(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Obtiene los últimos N posts para la home.
 */
export async function getRecentPosts(count: number = 3): Promise<BlogPost[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BlogPost);
    }
  } catch {
    // fallback
  }
  return FALLBACK_POSTS.slice(0, count);
}
