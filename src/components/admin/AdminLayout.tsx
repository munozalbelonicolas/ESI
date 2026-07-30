import { Outlet, NavLink, Link } from 'react-router-dom';
import { ADMIN_NAV_LINKS, SITE_CONFIG } from '../../config/site';
import { FiGrid, FiPackage, FiEdit3, FiShoppingCart, FiTag, FiTruck, FiArrowLeft } from 'react-icons/fi';
import './Admin.css';

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <FiGrid />, products: <FiPackage />, blog: <FiEdit3 />,
  orders: <FiShoppingCart />, coupons: <FiTag />, shipping: <FiTruck />,
};

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin__sidebar">
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
            >
              {ICONS[link.icon]} {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin__sidebar-footer">
          <Link to="/" className="admin__nav-link"><FiArrowLeft /> Volver al sitio</Link>
        </div>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
