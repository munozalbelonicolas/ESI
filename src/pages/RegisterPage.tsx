import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { SITE_CONFIG } from '../config/site';
import { FiMail, FiLock, FiUser, FiPhone, FiUserPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await registerUser(form.email, form.password, form.name, form.phone);
      toast.success('¡Cuenta creada! Revisá tu email para verificarla.');
      navigate('/');
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Ya existe una cuenta con ese email'
        : 'Error al crear la cuenta';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page section">
      <div className="auth-card">
        <div className="auth-card__header">
          <img src={SITE_CONFIG.logo} alt={SITE_CONFIG.name} className="auth-card__logo" />
          <h1>Crear cuenta</h1>
          <p>Registrate para acceder a todos nuestros recursos</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label className="form-label" htmlFor="name"><FiUser size={14} /> Nombre completo</label>
            <input id="name" type="text" className="form-input" value={form.name} onChange={update('name')} placeholder="Tu nombre" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email"><FiMail size={14} /> Email</label>
            <input id="reg-email" type="email" className="form-input" value={form.email} onChange={update('email')} placeholder="tu@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="phone"><FiPhone size={14} /> Teléfono (opcional)</label>
            <input id="phone" type="tel" className="form-input" value={form.phone} onChange={update('phone')} placeholder="1134567890" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-pw"><FiLock size={14} /> Contraseña</label>
              <input id="reg-pw" type="password" className="form-input" value={form.password} onChange={update('password')} placeholder="••••••" required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-pw2"><FiLock size={14} /> Confirmar</label>
              <input id="reg-pw2" type="password" className="form-input" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="••••••" required minLength={6} />
            </div>
          </div>
          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading ? <div className="spinner spinner--sm" /> : <><FiUserPlus /> Crear cuenta</>}
          </button>
        </form>
        <div className="auth-card__footer">
          <p>¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link></p>
        </div>
      </div>
    </div>
  );
}
