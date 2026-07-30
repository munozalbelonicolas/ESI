import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPostBySlug } from '../services/blogService';
import { formatDate } from '../utils/formatDate';
import type { BlogPost } from '../types/blog';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="section">
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
        <h1 style={{ marginBottom: 24, lineHeight: 1.2 }}>{post.title}</h1>
        {post.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {post.tags.map((tag) => (
              <span key={tag} className="badge badge--new">{tag}</span>
            ))}
          </div>
        )}
        <div className="rich-text" dangerouslySetInnerHTML={{ __html: post.body }} />
      </div>
    </div>
  );
}
