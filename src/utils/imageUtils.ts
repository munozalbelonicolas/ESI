/**
 * Optimiza URLs de imágenes (especialmente Cloudinary) para cargar versiones
 * livianas con formato WebP/AVIF automático, compresión de calidad y dimensiones adecuadas.
 */

export function getOptimizedImageUrl(url?: string | null, width: number = 500): string {
  if (!url) return '/placeholder-product.png';

  // Si es una URL de Cloudinary
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    // Evitar duplicar transformaciones si ya existen
    if (url.includes('/f_auto,q_auto')) {
      return url;
    }
    const transformation = `f_auto,q_auto,w_${width},c_limit`;
    return url.replace('/upload/', `/upload/${transformation}/`);
  }

  return url;
}
