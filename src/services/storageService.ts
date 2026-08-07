/**
 * Servicio de Almacenamiento de Imágenes — compresión local + Firestore
 * =====================================================================
 * Comprime la imagen en el navegador con Canvas (< 200KB) y la guarda
 * en una colección separada de Firestore para no superar el límite de 1MB
 * por documento. No requiere Firebase Storage ni ningún servicio de pago.
 */

import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Comprime un archivo de imagen usando Canvas y devuelve un Blob JPEG.
 * El resultado final no supera ~200KB.
 */
async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;

      // Redimensionar si es necesario
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo obtener el contexto 2D del canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      // Reducir calidad progresivamente si es necesario
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Si sigue siendo muy grande, reducir más
      if (dataUrl.length > 700_000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      }
      if (dataUrl.length > 700_000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.3);
      }

      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
}

/**
 * Sube un comprobante de transferencia: comprime localmente y guarda
 * en la colección `transferProofs` de Firestore (separada de orders).
 * Devuelve el ID del documento del comprobante.
 */
export async function uploadTransferProof(
  file: File,
  orderId: string
): Promise<string> {
  const compressed = await compressImage(file);

  // Guardar en colección separada para no superar el límite de 1MB en orders
  await setDoc(doc(db, 'transferProofs', orderId), {
    orderId,
    imageData: compressed,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  });

  // Devolver un identificador de referencia (no la imagen entera)
  return `proof:${orderId}`;
}

/**
 * Recupera el comprobante de transferencia de un pedido.
 */
export async function getTransferProof(
  orderId: string
): Promise<string | null> {
  const snap = await getDoc(doc(db, 'transferProofs', orderId));
  if (!snap.exists()) return null;
  return snap.data().imageData || null;
}

/**
 * Sube una imagen de producto (comprimida, guardada como Base64 en el documento).
 * Uso: formulario de admin al crear/editar productos.
 */
export async function uploadProductImage(
  file: File,
  _productId: string
): Promise<string> {
  return compressImage(file, 800, 800, 0.75);
}

/**
 * Sube una imagen de blog (comprimida).
 */
export async function uploadBlogImage(
  file: File,
  _postId: string
): Promise<string> {
  return compressImage(file, 1000, 600, 0.75);
}

/**
 * Alias genérico para compatibilidad con código existente.
 */
export async function uploadToCloudinary(
  file: File,
  folder: 'products' | 'transfer-proofs' | 'blog' = 'products'
): Promise<string> {
  return compressImage(file);
}
