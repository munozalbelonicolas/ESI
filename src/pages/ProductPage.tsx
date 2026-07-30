import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductBySlug } from '../services/productService';
import { useCartContext } from '../context/CartContext';
import { formatPrice, calcDiscount } from '../utils/formatPrice';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { getShippingQuotes, isValidShippingZipCode, type ShippingQuote } from '../services/shippingService';
import { trackViewItem, trackAddToCart } from '../config/analytics';
import type { Product } from '../types/product';
import { FiShoppingBag, FiArrowLeft, FiMinus, FiPlus, FiDownload, FiTruck, FiSearch, FiTag, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './ProductPage.css';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [calcZip, setCalcZip] = useState('');
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
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

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidShippingZipCode(calcZip)) {
      toast.error('Ingresá un código postal válido (4 dígitos)');
      return;
    }
    setCalcLoading(true);
    try {
      const weight = (product.weightGrams || 500) * quantity;
      const res = await getShippingQuotes(calcZip, weight, product.customShippingPrice);
      setQuotes(res);
    } catch {
      toast.error('Error al cotizar envío');
    } finally {
      setCalcLoading(false);
    }
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

            {product.transferDiscountPercent && product.transferDiscountPercent > 0 && !product.isFree && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#e8f8f5', borderRadius: 8, border: '1px solid #a3e4d7', color: '#117a65', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FiTag size={20} style={{ color: '#16a085', flexShrink: 0 }} />
                <div>
                  <strong>{product.transferDiscountPercent}% OFF</strong> pagando con <b>Transferencia Bancaria</b>
                  <div style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>
                    Precio final: <strong style={{ fontSize: 'var(--text-sm)', color: '#0e6251' }}>{formatPrice(Math.round(product.price * (1 - product.transferDiscountPercent / 100)))}</strong>
                  </div>
                </div>
              </div>
            )}

            {product.isDigital && (
              <p className="product-page__digital-note" style={{ marginTop: 12 }}>
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

            {!product.isDigital && (
              <div className="product-page__shipping-calc" style={{ marginTop: 24, padding: 16, background: 'var(--color-bg-alt)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255, 225, 100, 0.3)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--color-text)' }}>
                  <FiInfo size={16} style={{ color: 'var(--color-primary-dark)', flexShrink: 0 }} />
                  <span>📦 Envíos: miércoles y viernes — Tener en cuenta los tiempos de producción</span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <FiTruck size={18} style={{ color: 'var(--color-primary)' }} /> Calcular envío por Correo Argentino
                </h4>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Ingresá tu código postal para conocer las opciones y costos de entrega.
                </p>
                <form onSubmit={handleCalculateShipping} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: 1425"
                    maxLength={4}
                    value={calcZip}
                    onChange={(e) => setCalcZip(e.target.value.replace(/\D/g, ''))}
                    style={{ width: 120 }}
                  />
                  <button type="submit" className="btn btn--outline btn--sm" disabled={calcLoading || calcZip.length !== 4}>
                    {calcLoading ? 'Calculando...' : 'Calcular'}
                  </button>
                </form>

                {quotes.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {quotes.map((q) => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-bg)', borderRadius: 8, fontSize: 'var(--text-xs)', border: '1px solid var(--color-border)' }}>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--color-text)' }}>{q.name}</strong>
                          <span style={{ color: 'var(--color-text-muted)' }}>Llega en {q.estimatedDays}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>{formatPrice(q.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
