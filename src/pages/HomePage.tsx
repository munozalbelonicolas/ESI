import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProducts } from '../services/productService';
import { getRecentPosts } from '../services/blogService';
import ProductCard from '../components/shop/ProductCard';
import { SITE_CONFIG } from '../config/site';
import { PRODUCT_CATEGORIES } from '../types/product';
import type { Product } from '../types/product';
import type { BlogPost } from '../types/blog';
import { formatDate } from '../utils/formatDate';
import { FiArrowRight, FiBookOpen, FiHeart, FiUsers, FiAward } from 'react-icons/fi';
import crisImage from '../assets/cris.svg';
import './HomePage.css';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [prods, blogPosts] = await Promise.all([
          getFeaturedProducts(8),
          getRecentPosts(3),
        ]);
        setProducts(prods);
        setPosts(blogPosts);
      } catch (err) {
        console.error('Error cargando home:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="home">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__bg" />
        <div className="container hero__content">
          <div className="hero__text animate-slide-up">
            <span className="hero__eyebrow">Recursos de ESI para el aula</span>
            <h1 className="hero__title">
              Educación Sexual Integral
              <br />
              <span className="hero__title-accent">para Secundaria</span>
            </h1>
            <p className="hero__subtitle">
              Cuadernillos, juegos didácticos, efemérides y recursos listos para usar en el aula.
              Diseñados por docentes, para docentes.
            </p>
            <div className="hero__actions">
              <Link to="/tienda" className="btn btn--primary btn--lg">
                Ver recursos <FiArrowRight />
              </Link>
              <Link to="/blog" className="btn btn--outline btn--lg">
                Leer el blog
              </Link>
            </div>
          </div>
          <div className="hero__visual animate-fade-in">
            <img src={SITE_CONFIG.logo} alt="ESI en Secundaria" className="hero__logo-img" />
          </div>
        </div>
      </section>

      {/* ── Propuesta de valor ── */}
      <section className="value-props section">
        <div className="container">
          <div className="value-props__grid">
            <div className="value-prop animate-slide-up">
              <div className="value-prop__icon">
                <FiBookOpen size={32} />
              </div>
              <h3>Materiales listos para usar</h3>
              <p>Descargá cuadernillos, secuencias didácticas y actividades que podés llevar directamente al aula.</p>
            </div>
            <div className="value-prop animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="value-prop__icon">
                <FiHeart size={32} />
              </div>
              <h3>Enfoque pedagógico</h3>
              <p>Creamos materiales que convierten la ESI en experiencias de enseñanza significativas, promoviendo el pensamiento crítico, la participación, la convivencia democrática y el ejercicio de los derechos.</p>
            </div>
            <div className="value-prop animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="value-prop__icon">
                <FiUsers size={32} />
              </div>
              <h3>Hechos por docentes</h3>
              <p>Creados por profesionales de la educación con experiencia real en secundaria y formación en ESI.</p>
            </div>
            <div className="value-prop animate-slide-up" style={{ animationDelay: '300ms' }}>
              <div className="value-prop__icon">
                <FiAward size={32} />
              </div>
              <h3>Actualizados y vigentes</h3>
              <p>Materiales alineados con los lineamientos curriculares de ESI de la Argentina y las efemérides del año.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categorías ── */}
      <section className="categories section section--alt">
        <div className="container">
          <div className="section-header">
            <h2>Explorá nuestras categorías</h2>
            <p>Todo lo que necesitás para abordar la ESI con seguridad</p>
          </div>
          <div className="categories__grid">
            {PRODUCT_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                to={`/tienda?cat=${encodeURIComponent(cat)}`}
                className="category-chip"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Productos destacados ── */}
      <section className="featured section">
        <div className="container">
          <div className="section-header">
            <h2>Recursos más recientes</h2>
            <Link to="/tienda" className="section-header__link">
              Ver todos <FiArrowRight />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid--products">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 320, borderRadius: 12 }} />
              ))}
            </div>
          ) : (
            <div className="grid grid--products">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Sobre nosotros ── */}
      <section className="about section section--alt" id="sobre-nosotros">
        <div className="container">
          <div className="about__grid">
            <div className="about__content">
              <span className="hero__eyebrow">Sobre nosotros</span>
              <h2>¿Quién soy?</h2>
              <p>
                <strong>Soy Cristina Bronzatti</strong>, profesora de Lengua y Literatura, Licenciada en Educación y "Especialista en Educación Sexual Integral" (INFoD y UBA). Trabajo en los niveles secundario y superior.
              </p>
              <p>
                Esta cuenta nació un 3 de junio, en el marco de "Ni Una Menos", cuando no pudimos salir a marchar y la militancia encontró en las redes un espacio posible. ✊🏼
              </p>
              <p>
                Desde entonces comparto materiales, reflexiones y propuestas para enseñar ESI desde un enfoque de derechos, con perspectiva pedagógica y profundamente anclada en la práctica cotidiana de las escuelas.
              </p>
              <p>
                Acá vas a encontrar recursos gratuitos, secuencias didácticas, juegos, debates, cursos y materiales pensados para quienes creen que la ESI también se construye enseñando.
              </p>
              <p>
                Si sos docente, estudiante de formación docente o la ESI forma parte de tu práctica educativa, este espacio es para vos. 💜
              </p>
              <div className="about__stats">
                <div className="about__stat">
                  <span className="about__stat-number">+2500</span>
                  <span className="about__stat-label">Docentes confían en nuestros recursos</span>
                </div>
                <div className="about__stat">
                  <span className="about__stat-number">+60</span>
                  <span className="about__stat-label">Materiales disponibles</span>
                </div>
                <div className="about__stat">
                  <span className="about__stat-number">7</span>
                  <span className="about__stat-label">Categorías temáticas</span>
                </div>
              </div>
            </div>
            <div className="about__visual">
              <div className="about__image-wrapper">
                <div className="about__portrait-frame">
                  <img src={crisImage} alt="Cristina Bronzatti — ESI en Secundaria" className="about__portrait-img" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Blog recientes ── */}
      {posts.length > 0 && (
        <section className="blog-preview section">
          <div className="container">
            <div className="section-header">
              <h2>Últimas del blog</h2>
              <Link to="/blog" className="section-header__link">
                Ver todas <FiArrowRight />
              </Link>
            </div>
            <div className="grid grid--blog">
              {posts.map((post) => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="blog-preview-card card">
                  {post.coverImage && (
                    <img src={post.coverImage} alt={post.title} className="blog-preview-card__image" loading="lazy" />
                  )}
                  <div className="blog-preview-card__body">
                    <span className="blog-preview-card__date">{formatDate(post.publishedAt)}</span>
                    <h3 className="blog-preview-card__title">{post.title}</h3>
                    <p className="blog-preview-card__excerpt">{post.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA final ── */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card">
            <h2>¿Lista/o para transformar tus clases de ESI?</h2>
            <p>Encontrá el recurso que necesitás y llevalo al aula hoy mismo.</p>
            <Link to="/tienda" className="btn btn--secondary btn--lg">
              Explorar la tienda <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
