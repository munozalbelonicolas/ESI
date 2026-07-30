/**
 * Servicio de Almacenamiento de Imágenes — Cloudinary (100% Gratuito)
 * ================================================================
 * Utiliza la API de subida no firmada (Unsigned Upload) de Cloudinary
 * para evitar usar el Storage de Firebase y mantener el plan Spark gratuito.
 *
 * SEGURIDAD: Solo se usa Unsigned Upload (upload_preset). El API Secret
 * NUNCA debe exponerse en el frontend. Si necesitás Signed Upload,
 * implementalo en una Cloud Function del backend.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Convierte un archivo a Data URL Base64 para fallback local.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Sube una imagen a Cloudinary usando Unsigned Upload (seguro para frontend).
 */
export async function uploadToCloudinary(
  file: File,
  folder: 'products' | 'transfer-proofs' | 'blog' = 'products'
): Promise<string> {
  // Si no hay Cloud Name o Upload Preset configurados, usar fallback Base64
  if (!CLOUD_NAME || !UPLOAD_PRESET || CLOUD_NAME === 'your_cloud_name') {
    console.warn(
      `[Cloudinary] VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET no configurados. Usando Base64 DataURL.`
    );
    return fileToBase64(file);
  }

  const targetFolder = `esi_secundaria/${folder}`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', targetFolder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al subir imagen a Cloudinary');
  }

  const data = await res.json();
  return data.secure_url;
}

/**
 * Sube una imagen de producto.
 */
export async function uploadProductImage(
  file: File,
  _productId: string
): Promise<string> {
  return uploadToCloudinary(file, 'products');
}

/**
 * Sube un comprobante de transferencia bancaria.
 */
export async function uploadTransferProof(
  file: File,
  _orderId: string
): Promise<string> {
  return uploadToCloudinary(file, 'transfer-proofs');
}

/**
 * Sube una imagen de entrada de blog.
 */
export async function uploadBlogImage(
  file: File,
  _postId: string
): Promise<string> {
  return uploadToCloudinary(file, 'blog');
}
