import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductBySlug } from '../services/productService';
import { useCartContext } from '../context/CartContext';
import { formatPrice, calcDiscount } from '../utils/formatPrice';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { trackViewItem, trackAddToCart } from '../config/analytics';
import type { Product } from '../types/product';
import { FiShoppingBag, FiArrowLeft, FiMinus, FiPlus, FiDownload } from 'react-icons/fi';
import './ProductPage.css';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem, isInCart } = useCartContext();

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setLoading(true);
      const p = await getProductBySlug(slug);
      setProduct(p);
      if (p) trackViewItem(p.id, p.name, p.price);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!product) return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <h2>Producto no encontrado</h2>
      <Link to="/tienda" className="btn btn--primary" style={{ marginTop: 16 }}>Volver a la tienda</Link>
    </div>
  );

  const discount = product.compareAtPrice ? calcDiscount(product.price, product.compareAtPrice) : 0;
  const isOutOfStock = !product.isDigital && product.stock === 0;
  const alreadyInCart = isInCart(product.id);

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem(product, quantity);
    trackAddToCart(product.id, product.name, product.price, quantity);
  };

  return (
    <div className="product-page section">
      <div className="container">
        <Link to="/tienda" className="product-page__back">
          <FiArrowLeft /> Volver a la tienda
        </Link>
        <div className="product-page__grid">
          {/* Images */}
          <div className="product-page__images">
            <div className="product-page__main-image-wrapper">
              {discount > 0 && <span className="badge badge--sale product-page__badge">{discount}% OFF</span>}
              {product.isFree && <span className="badge badge--free product-page__badge">Gratis</span>}
              {isOutOfStock && <span className="badge badge--out product-page__badge">Sin stock</span>}
              <img
                src={getOptimizedImageUrl(product.images[selectedImage], 800)}
                alt={product.name}
                className="product-page__main-image"
                loading="eager"
                decoding="async"
              />
            </div>
            {product.images.length > 1 && (
              <div className="product-page__thumbs">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    className={`product-page__thumb ${i === selectedImage ? 'product-page__thumb--active' : ''}`}
                    onClick={() => setSelectedImage(i)}
                  >
                    <img src={getOptimizedImageUrl(img, 150)} alt={`${product.name} ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="product-page__info">
            <span className="product-page__category">{product.category}</span>
            <h1 className="product-page__name">{product.name}</h1>

            <div className="product-page__price-row">
              {product.isFree ? (
                <span className="product-page__price product-page__price--free">Gratis</span>
              ) : (
                <>
                  <span className="product-page__price">{formatPrice(product.price)}</span>
                  {product.compareAtPrice && (
                    <span className="product-page__compare">{formatPrice(product.compareAtPrice)}</span>
                  )}
                </>
              )}
            </div>

            {product.isDigital && (
              <p className="product-page__digital-note">
                <FiDownload /> Producto digital — se envía por email después de la compra
              </p>
            )}

            {!isOutOfStock && !product.isDigital && product.stock > 0 && product.stock <= 5 && (
              <p className="product-page__low-stock">¡Últimas {product.stock} unidades!</p>
            )}

            <p className="product-page__short-desc">{product.shortDescription}</p>

            <div className="product-page__actions">
              {!product.isFree && !isOutOfStock && (
                <div className="product-page__quantity">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="product-page__qty-btn"><FiMinus /></button>
                  <span className="product-page__qty-value">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="product-page__qty-btn"><FiPlus /></button>
                </div>
              )}
              <button
                className={`btn ${alreadyInCart ? 'btn--ghost' : 'btn--primary'} btn--lg btn--full`}
                onClick={handleAdd}
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Sin stock' : alreadyInCart ? '✓ Ya está en el carrito' : (
                  <>{product.isDigital ? <FiDownload /> : <FiShoppingBag />} {product.isFree ? 'Obtener gratis' : 'Agregar al carrito'}</>
                )}
              </button>
            </div>

            {/* Description */}
            <div className="product-page__description">
              <h3>Descripción</h3>
              <div className="rich-text" dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
