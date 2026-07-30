import { useState, useEffect } from 'react';
import { getAllPosts, createPost, updatePost, deletePost } from '../../services/blogService';
import { formatDateShort } from '../../utils/formatDate';
import type { BlogPost, BlogPostFormData } from '../../types/blog';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogPostFormData>({
    title: '', body: '', excerpt: '', coverImage: '', isPublished: false, tags: [],
  });

  const loadPosts = async () => { setPosts(await getAllPosts()); setLoading(false); };
  useEffect(() => { loadPosts(); }, []);

  const resetForm = () => { setForm({ title: '', body: '', excerpt: '', coverImage: '', isPublished: false, tags: [] }); setEditingId(null); setShowForm(false); };

  const handleEdit = (p: BlogPost) => {
    setForm({ title: p.title, body: p.body, excerpt: p.excerpt, coverImage: p.coverImage, isPublished: p.isPublished, tags: p.tags });
    setEditingId(p.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) { await updatePost(editingId, form); toast.success('Post actualizado'); }
      else { await createPost(form); toast.success('Post creado'); }
      resetForm(); loadPosts();
    } catch { toast.error('Error al guardar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await deletePost(id); toast.success('Eliminado'); loadPosts();
  };

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Blog ({posts.length})</h1>
        <button className="btn btn--primary" onClick={() => { resetForm(); setShowForm(true); }}><FiPlus /> Nueva entrada</button>
      </div>

      {showForm && (
        <div className="admin-form" style={{ marginBottom: 24, maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3>{editingId ? 'Editar entrada' : 'Nueva entrada'}</h3>
            <button onClick={resetForm} className="btn btn--ghost btn--icon"><FiX /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" value={form.title} onChange={e => update('title', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Extracto</label>
              <textarea className="form-textarea" value={form.excerpt} onChange={e => update('excerpt', e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Cuerpo (HTML)</label>
              <textarea className="form-textarea" value={form.body} onChange={e => update('body', e.target.value)} rows={12} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">URL de imagen de portada</label>
                <input className="form-input" value={form.coverImage} onChange={e => update('coverImage', e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (separados por coma)</label>
                <input className="form-input" value={form.tags.join(', ')} onChange={e => update('tags', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))} placeholder="ESI, recursos, efemérides" />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={form.isPublished} onChange={e => update('isPublished', e.target.checked)} /> Publicar
            </label>
            <div className="admin-form__actions">
              <button type="submit" className="btn btn--primary">{editingId ? 'Guardar' : 'Crear entrada'}</button>
              <button type="button" className="btn btn--ghost" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead><tr><th>Título</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.title}</td>
                <td>{formatDateShort(p.createdAt)}</td>
                <td>{p.isPublished ? <span className="badge badge--free">Publicado</span> : <span className="badge badge--sale">Borrador</span>}</td>
                <td>
                  <div className="admin-table__actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(p)}><FiEdit2 /></button>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-error)' }}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
