import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { ADMIN_NAV_LINKS, SITE_CONFIG } from '../../config/site';
import { FiGrid, FiPackage, FiEdit3, FiShoppingCart, FiTag, FiTruck, FiCreditCard, FiDollarSign, FiArrowLeft, FiMenu, FiX } from 'react-icons/fi';
import './Admin.css';

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <FiGrid />, products: <FiPackage />, blog: <FiEdit3 />,
  orders: <FiShoppingCart />, coupons: <FiTag />, shipping: <FiTruck />, bank: <FiCreditCard />, mp: <FiDollarSign />,
};

export default function AdminLayout() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <div className="admin">
      {/* Top Header Bar for Mobile/Tablet */}
      <header className="admin__topbar">
        <div className="admin__topbar-brand">
          <img src={SITE_CONFIG.logo} alt="Admin" className="admin__sidebar-logo" />
          <span className="admin__sidebar-title">Panel Admin</span>
        </div>
        <button
          type="button"
          className="admin__hamburger-btn"
          onClick={toggleMenu}
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isOpen ? <FiX size={26} /> : <FiMenu size={26} />}
        </button>
      </header>

      {/* Backdrop overlay when open on mobile */}
      {isOpen && <div className="admin__overlay" onClick={closeMenu} />}

      {/* Sidebar */}
      <aside className={`admin__sidebar ${isOpen ? 'admin__sidebar--open' : ''}`}>
        <div className="admin__sidebar-header">
          <img src={SITE_CONFIG.logo} alt="Admin" className="admin__sidebar-logo" />
          <span className="admin__sidebar-title">Panel Admin</span>
        </div>
        <nav className="admin__nav">
          {ADMIN_NAV_LINKS.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/admin'}
              className={({ isActive }) => `admin__nav-link ${isActive ? 'admin__nav-link--active' : ''}`}
              onClick={closeMenu}
            >
              <span className="admin__nav-icon">{ICONS[link.icon]}</span>
              <span className="admin__nav-text">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin__sidebar-footer">
          <Link to="/" className="admin__nav-link" onClick={closeMenu}>
            <FiArrowLeft /> <span className="admin__nav-text">Volver al sitio</span>
          </Link>
        </div>
      </aside>

      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}

