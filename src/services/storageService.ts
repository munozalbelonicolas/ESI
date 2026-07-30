import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Sube una imagen de producto a Firebase Storage.
 */
export async function uploadProductImage(
  file: File,
  productId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `products/${productId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Sube un comprobante de transferencia.
 */
export async function uploadTransferProof(
  file: File,
  orderId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `transfer-proofs/${orderId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Sube una imagen de blog.
 */
export async function uploadBlogImage(
  file: File,
  postId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `blog/${postId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
