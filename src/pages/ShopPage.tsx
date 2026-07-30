import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProducts } from '../services/productService';
import ProductCard from '../components/shop/ProductCard';
import { PRODUCT_CATEGORIES } from '../types/product';
import type { Product } from '../types/product';
import { FiFilter, FiX } from 'react-icons/fi';
import './ShopPage.css';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || '');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { products: prods } = await getProducts(activeCategory || undefined);
        setProducts(prods);
      } catch (err) {
        console.error('Error cargando productos:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCategory]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (cat) {
      setSearchParams({ cat });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="shop-page section">
      <div className="container">
        <div className="shop-page__header">
          <h1>Tienda</h1>
          <p>Recursos de ESI diseñados por docentes, para docentes</p>
        </div>

        {/* Filtros */}
        <div className="shop-page__filters">
          <div className="shop-page__filters-label">
            <FiFilter size={16} /> Filtrar por:
          </div>
          <div className="shop-page__filter-chips">
            <button
              className={`filter-chip ${!activeCategory ? 'filter-chip--active' : ''}`}
              onClick={() => handleCategoryChange('')}
            >
              Todos
            </button>
            {PRODUCT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${activeCategory === cat ? 'filter-chip--active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
                {activeCategory === cat && <FiX size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de productos */}
        {loading ? (
          <div className="grid grid--products">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 360, borderRadius: 12 }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="shop-page__empty">
            <h3>No hay productos en esta categoría</h3>
            <p>Probá con otra categoría o explorá todos nuestros recursos.</p>
            <button className="btn btn--primary" onClick={() => handleCategoryChange('')}>
              Ver todos
            </button>
          </div>
        ) : (
          <div className="grid grid--products">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
