import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, resetPassword } from '../services/authService';
import { SITE_CONFIG } from '../config/site';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginUser(email, password);
      toast.success('¡Bienvenida/o de vuelta!');
      navigate('/');
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Email o contraseña incorrectos'
        : err.code === 'auth/too-many-requests'
        ? 'Demasiados intentos. Esperá un momento y volvé a intentar.'
        : 'Error al iniciar sesión';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Ingresá tu correo electrónico');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success('Enviamos las instrucciones a tu correo');
      setResetModalOpen(false);
      setResetEmail('');
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found'
        ? 'No existe ninguna cuenta asociada a este correo'
        : 'Error al enviar el correo de recuperación';
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page section">
      <div className="auth-card">
        <div className="auth-card__header">
          <img src={SITE_CONFIG.logo} alt={SITE_CONFIG.name} className="auth-card__logo" />
          <h1>Iniciar sesión</h1>
          <p>Accedé a tu cuenta para comprar recursos</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label className="form-label" htmlFor="email"><FiMail size={14} /> Email</label>
            <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="password"><FiLock size={14} /> Contraseña</label>
              <button
                type="button"
                onClick={() => { setResetEmail(email); setResetModalOpen(true); }}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-secondary)', textDecoration: 'underline', padding: 0 }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <input id="password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required minLength={6} />
          </div>
          <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
            {loading ? <div className="spinner spinner--sm" /> : <><FiLogIn /> Ingresar</>}
          </button>
        </form>
        <div className="auth-card__footer">
          <p>¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link></p>
        </div>
      </div>

      {/* Modal de Recuperar Contraseña */}
      {resetModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 16, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 8 }}>Recuperar contraseña</h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginBottom: 16 }}>
              Ingresá tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label"><FiMail size={14} /> Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setResetModalOpen(false)} disabled={resetLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={resetLoading}>
                  {resetLoading ? <div className="spinner spinner--sm" /> : 'Enviar enlace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
