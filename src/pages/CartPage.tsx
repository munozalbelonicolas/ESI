import { Link } from 'react-router-dom';
import { useCartContext } from '../context/CartContext';
import { formatPrice } from '../utils/formatPrice';
import { FiTrash2, FiMinus, FiPlus, FiArrowRight, FiShoppingBag } from 'react-icons/fi';
import './CartPage.css';

export default function CartPage() {
  const { items, removeItem, updateQuantity, getSubtotal, clearCart } = useCartContext();

  if (items.length === 0) {
    return (
      <div className="cart-page section">
        <div className="container" style={{ textAlign: 'center' }}>
          <FiShoppingBag size={64} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <h2>Tu carrito está vacío</h2>
          <p style={{ color: 'var(--color-text-light)', marginBottom: 24 }}>Explorá nuestra tienda y encontrá el recurso que necesitás.</p>
          <Link to="/tienda" className="btn btn--primary btn--lg">Ver recursos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page section">
      <div className="container">
        <h1>Mi carrito</h1>
        <div className="cart-page__grid">
          <div className="cart-page__items">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="cart-item">
                <img src={product.images[0] || '/placeholder-product.png'} alt={product.name} className="cart-item__image" />
                <div className="cart-item__info">
                  <Link to={`/tienda/${product.slug}`} className="cart-item__name">{product.name}</Link>
                  <span className="cart-item__category">{product.category}</span>
                  <span className="cart-item__price">{formatPrice(product.price)}</span>
                </div>
                <div className="cart-item__quantity">
                  <button onClick={() => updateQuantity(product.id, quantity - 1)} className="cart-item__qty-btn"><FiMinus size={14} /></button>
                  <span>{quantity}</span>
                  <button onClick={() => updateQuantity(product.id, quantity + 1)} className="cart-item__qty-btn"><FiPlus size={14} /></button>
                </div>
                <span className="cart-item__total">{formatPrice(product.price * quantity)}</span>
                <button onClick={() => removeItem(product.id)} className="cart-item__remove"><FiTrash2 size={18} /></button>
              </div>
            ))}
          </div>
          <div className="cart-page__summary">
            <h3>Resumen</h3>
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <span>{formatPrice(getSubtotal())}</span>
            </div>
            <div className="cart-summary__row cart-summary__row--total">
              <span>Total</span>
              <span>{formatPrice(getSubtotal())}</span>
            </div>
            <Link to="/checkout" className="btn btn--primary btn--full btn--lg" style={{ marginTop: 16 }}>
              Iniciar compra <FiArrowRight />
            </Link>
            <button onClick={clearCart} className="btn btn--ghost btn--full btn--sm" style={{ marginTop: 8 }}>
              Vaciar carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
