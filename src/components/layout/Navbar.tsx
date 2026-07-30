import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useCartContext } from '../../context/CartContext';
import { SITE_CONFIG, NAV_LINKS } from '../../config/site';
import { logoutUser } from '../../services/authService';
import { FiShoppingBag, FiMenu, FiX, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import './Navbar.css';

export default function Navbar() {
  const { firebaseUser, isAdmin, profile } = useAuthContext();
  const { getItemCount } = useCartContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const itemCount = getItemCount();

  const handleLogout = async () => {
    await logoutUser();
    setUserMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo">
          <img src={SITE_CONFIG.logo} alt={SITE_CONFIG.name} className="navbar__logo-img" />
        </Link>

        {/* Desktop nav */}
        <nav className="navbar__nav hide-mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`navbar__link ${location.pathname === link.path ? 'navbar__link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="navbar__actions">
          <Link to="/carrito" className="navbar__cart-btn" aria-label="Ver carrito">
            <FiShoppingBag size={22} />
            {itemCount > 0 && <span className="navbar__cart-badge">{itemCount}</span>}
          </Link>

          {firebaseUser ? (
            <div className="navbar__user-menu-wrapper">
              <button
                className="navbar__user-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="Menú de usuario"
              >
                <FiUser size={22} />
              </button>
              {userMenuOpen && (
                <div className="navbar__user-dropdown">
                  <p className="navbar__user-name">{profile?.displayName || firebaseUser.email}</p>
                  <Link to="/perfil" className="navbar__dropdown-link" onClick={() => setUserMenuOpen(false)}>
                    <FiUser size={16} /> Mi perfil
                  </Link>
                  <Link to="/mis-ordenes" className="navbar__dropdown-link" onClick={() => setUserMenuOpen(false)}>
                    <FiShoppingBag size={16} /> Mis pedidos
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="navbar__dropdown-link navbar__dropdown-link--admin" onClick={() => setUserMenuOpen(false)}>
                      <FiSettings size={16} /> Panel admin
                    </Link>
                  )}
                  <button className="navbar__dropdown-link navbar__dropdown-link--logout" onClick={handleLogout}>
                    <FiLogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn--primary btn--sm hide-mobile">
              Iniciar sesión
            </Link>
          )}

          <button
            className="navbar__hamburger hide-desktop"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menú"
          >
            {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="navbar__mobile-menu">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="navbar__mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {!firebaseUser && (
            <Link to="/login" className="btn btn--primary btn--full" onClick={() => setMobileOpen(false)}>
              Iniciar sesión
            </Link>
          )}
          {firebaseUser && !isAdmin && (
            <>
              <Link to="/perfil" className="navbar__mobile-link" onClick={() => setMobileOpen(false)}>Mi perfil</Link>
              <Link to="/mis-ordenes" className="navbar__mobile-link" onClick={() => setMobileOpen(false)}>Mis pedidos</Link>
              <button className="navbar__mobile-link navbar__mobile-link--logout" onClick={handleLogout}>Cerrar sesión</button>
            </>
          )}
          {isAdmin && (
            <Link to="/admin" className="btn btn--secondary btn--full" onClick={() => setMobileOpen(false)}>
              Panel admin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
