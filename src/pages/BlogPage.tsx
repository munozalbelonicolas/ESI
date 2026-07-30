import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublishedPosts } from '../services/blogService';
import { formatDate } from '../utils/formatDate';
import type { BlogPost } from '../types/blog';
import './BlogPage.css';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getPublishedPosts();
      setPosts(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="blog-page section">
      <div className="container">
        <div className="blog-page__header">
          <h1>Blog</h1>
          <p>Reflexiones, recursos y novedades sobre Educación Sexual Integral</p>
        </div>
        {loading ? (
          <div className="grid grid--blog">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 350, borderRadius: 12 }} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="blog-page__empty">
            <h3>Próximamente</h3>
            <p>Estamos preparando contenido para vos. ¡Volvé pronto!</p>
          </div>
        ) : (
          <div className="grid grid--blog">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="blog-card card">
                {post.coverImage && (
                  <img src={post.coverImage} alt={post.title} className="blog-card__image" loading="lazy" />
                )}
                <div className="blog-card__body">
                  <div className="blog-card__meta">
                    <span className="blog-card__date">{formatDate(post.publishedAt)}</span>
                    {post.tags.length > 0 && (
                      <span className="blog-card__tag">{post.tags[0]}</span>
                    )}
                  </div>
                  <h2 className="blog-card__title">{post.title}</h2>
                  <p className="blog-card__excerpt">{post.excerpt}</p>
                  <span className="blog-card__read-more">Leer más →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
