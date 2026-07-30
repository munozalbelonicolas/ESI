import { Link } from 'react-router-dom';
import { useCartContext } from '../../context/CartContext';
import { formatPrice, calcDiscount } from '../../utils/formatPrice';
import { trackAddToCart } from '../../config/analytics';
import type { Product } from '../../types/product';
import { FiShoppingBag, FiDownload } from 'react-icons/fi';
import './ProductCard.css';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { addItem, isInCart } = useCartContext();
  const discount = product.compareAtPrice ? calcDiscount(product.price, product.compareAtPrice) : 0;
  const isOutOfStock = !product.isDigital && product.stock === 0;
  const alreadyInCart = isInCart(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || alreadyInCart) return;
    addItem(product, 1);
    trackAddToCart(product.id, product.name, product.price, 1);
  };

  return (
    <Link to={`/tienda/${product.slug}`} className="product-card card">
      <div className="product-card__image-wrapper">
        <img
          src={product.images[0] || '/placeholder-product.png'}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
        />
        <div className="product-card__badges">
          {product.isFree && <span className="badge badge--free">Gratis</span>}
          {discount > 0 && <span className="badge badge--sale">{discount}% OFF</span>}
          {isOutOfStock && <span className="badge badge--out">Sin stock</span>}
          {product.isDigital && <span className="badge badge--digital">Digital</span>}
        </div>
      </div>
      <div className="product-card__body">
        <p className="product-card__category">{product.category}</p>
        <h3 className="product-card__name">{product.name}</h3>
        <div className="product-card__price-row">
          {product.isFree ? (
            <span className="product-card__price product-card__price--free">Gratis</span>
          ) : (
            <>
              <span className="product-card__price">{formatPrice(product.price)}</span>
              {product.compareAtPrice && (
                <span className="product-card__compare-price">{formatPrice(product.compareAtPrice)}</span>
              )}
            </>
          )}
        </div>
        <button
          className={`product-card__btn btn ${alreadyInCart ? 'btn--ghost' : 'btn--primary'} btn--sm btn--full`}
          onClick={handleAddToCart}
          disabled={isOutOfStock}
        >
          {isOutOfStock ? 'Sin stock' : alreadyInCart ? 'Ya en el carrito' : (
            <>
              {product.isDigital ? <FiDownload size={16} /> : <FiShoppingBag size={16} />}
              {product.isFree ? 'Obtener gratis' : 'Agregar al carrito'}
            </>
          )}
        </button>
      </div>
    </Link>
  );
}
