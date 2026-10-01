import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, resetPassword, loginWithGoogle } from '../services/authService';
import { SITE_CONFIG } from '../config/site';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success('¡Bienvenida/o!');
      navigate('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('No se pudo iniciar sesión con Google');
      }
    } finally {
      setGoogleLoading(false);
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

        {/* Botón Google */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          id="btn-google-login"
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
              Continuar con Google
            </>
          )}
        </button>

        {/* Separador */}
        <div className="auth-divider"><span>o</span></div>

        <div className="auth-card__footer">
          <p>¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link></p>
        </div>

      </div>{/* fin auth-card */}

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
