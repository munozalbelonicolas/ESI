import { createProduct } from '../services/productService';
import { createPost } from '../services/blogService';
import { createCoupon } from '../services/couponService';
import { SAMPLE_PRODUCTS, SAMPLE_POSTS, SAMPLE_COUPONS } from '../data/sampleData';

/**
 * Función helper para sembrar datos iniciales en Firestore.
 */
export async function seedInitialData() {
  console.log('Sembrando datos iniciales...');
  for (const prod of SAMPLE_PRODUCTS) {
    await createProduct(prod);
  }
  for (const post of SAMPLE_POSTS) {
    await createPost(post);
  }
  for (const coupon of SAMPLE_COUPONS) {
    await createCoupon(coupon);
  }
  console.log('¡Datos iniciales sembrados con éxito!');
}
