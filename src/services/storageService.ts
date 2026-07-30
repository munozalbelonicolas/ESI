/**
 * Servicio de Almacenamiento de Imágenes — Cloudinary (100% Gratuito)
 * ================================================================
 * Utiliza la API de subida no firmada (Unsigned Upload) de Cloudinary
 * para evitar usar el Storage de Firebase y mantener el plan Spark gratuito.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;

/**
 * Genera la firma SHA-1 necesaria para los uploads en modo Signed de Cloudinary.
 */
async function generateSignature(params: Record<string, string>, apiSecret: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  const stringToSign = `${serialized}${apiSecret}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
 * Sube una imagen a Cloudinary (Soporta modo Signed y Unsigned, o fallback a Base64).
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

  // Si están configuradas las credenciales de API Key y API Secret (Modo Signed)
  if (
    API_KEY &&
    API_SECRET &&
    API_KEY !== 'your_api_key' &&
    API_SECRET !== 'your_api_secret'
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await generateSignature(
      {
        folder: targetFolder,
        timestamp,
        upload_preset: UPLOAD_PRESET,
      },
      API_SECRET
    );

    formData.append('api_key', API_KEY);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
  }

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
