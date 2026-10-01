import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, loginWithGoogle } from '../services/authService';
import { SITE_CONFIG } from '../config/site';
import { FiMail, FiLock, FiUser, FiPhone, FiUserPlus } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success('¡Cuenta creada con Google!');
      navigate('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('No se pudo continuar con Google');
      }
    } finally {
      setGoogleLoading(false);
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

        {/* Separador */}
        <div className="auth-divider"><span>o</span></div>

        {/* Botón Google */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleRegister}
          disabled={googleLoading || loading}
          id="btn-google-register"
        >
          {googleLoading ? (
            <div className="spinner spinner--sm" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Registrarse con Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
