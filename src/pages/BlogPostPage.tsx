import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPostBySlug } from '../services/blogService';
import { formatDate } from '../utils/formatDate';
import type { BlogPost } from '../types/blog';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import { useSEO } from '../hooks/useSEO';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const blogJsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.title,
    image: post.coverImage || 'https://esiensecundaria.com.ar/ESI%20LOGO.webp',
    author: {
      '@type': 'Person',
      name: post.author || 'Cristina Bronzatti',
      jobTitle: 'Especialista en Educación Sexual Integral',
    },
    publisher: {
      '@type': 'Organization',
      name: 'ESI en Secundaria',
      logo: {
        '@type': 'ImageObject',
        url: 'https://esiensecundaria.com.ar/ESI%20LOGO.webp',
      },
    },
    datePublished: post.publishedAt?.toDate ? post.publishedAt.toDate().toISOString() : new Date().toISOString(),
    mainEntityOfPage: `https://esiensecundaria.com.ar/blog/${post.slug}`,
  } : undefined;

  useSEO({
    title: post ? post.title : 'Artículo de Blog',
    description: post?.excerpt ? post.excerpt.slice(0, 160) : 'Artículo pedagógico sobre Educación Sexual Integral en secundaria.',
    canonical: post ? `/blog/${post.slug}` : undefined,
    image: post?.coverImage,
    type: 'article',
    jsonLd: blogJsonLd,
  });

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const p = await getPostBySlug(slug);
      setPost(p);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!post) return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <h2>Entrada no encontrada</h2>
      <Link to="/blog" className="btn btn--primary" style={{ marginTop: 16 }}>Volver al blog</Link>
    </div>
  );

  return (
    <article className="section" aria-labelledby="blog-post-title">
      <div className="container container--narrow">
        <Link to="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-light)', fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 24 }}>
          <FiArrowLeft /> Volver al blog
        </Link>
        {post.coverImage && (
          <img src={post.coverImage} alt={post.title} style={{ width: '100%', borderRadius: 12, marginBottom: 24, aspectRatio: '16/7', objectFit: 'cover' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          <FiCalendar size={14} /> {formatDate(post.publishedAt)}
        </div>
        <h1 id="blog-post-title" style={{ marginBottom: 24, lineHeight: 1.2 }}>{post.title}</h1>
        {post.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {post.tags.map((tag) => (
              <span key={tag} className="badge badge--new">{tag}</span>
            ))}
          </div>
        )}
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: post.body }} />

        {/* ── Links internos — mejora SEO ── */}
        <nav aria-label="Navegación relacionada" style={{ marginTop: 48, padding: '24px', background: 'var(--color-bg-alt)', borderRadius: 12, borderTop: '3px solid var(--color-secondary)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 16, color: 'var(--color-secondary)' }}>
            ¿Te resultó útil este artículo?
          </h2>
          <p style={{ color: 'var(--color-text-light)', marginBottom: 16, fontSize: 'var(--text-sm)' }}>
            Explorá más recursos de Educación Sexual Integral para tus clases.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/tienda" className="btn btn--primary btn--sm">
              Ver recursos de ESI
            </Link>
            <Link to="/blog" className="btn btn--outline btn--sm">
              Más artículos del blog
            </Link>
            <Link to="/#sobre-nosotros" className="btn btn--ghost btn--sm">
              Sobre Cristina Bronzatti
            </Link>
          </div>
        </nav>
      </div>
    </article>
  );
}
