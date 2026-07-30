import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { SITE_CONFIG } from '../config/site';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
            <label className="form-label" htmlFor="password"><FiLock size={14} /> Contraseña</label>
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
    </div>
  );
}
