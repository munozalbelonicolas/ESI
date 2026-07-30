import { Link } from 'react-router-dom';
import { SITE_CONFIG, NAV_LINKS } from '../../config/site';
import { FiMail, FiInstagram } from 'react-icons/fi';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          {/* Brand */}
          <div className="footer__brand">
            <img src={SITE_CONFIG.logo} alt={SITE_CONFIG.name} className="footer__logo" />
            <p className="footer__tagline">{SITE_CONFIG.tagline}</p>
          </div>

          {/* Navigation */}
          <div className="footer__section">
            <h4 className="footer__title">Navegación</h4>
            <nav className="footer__nav">
              {NAV_LINKS.map((link) => (
                <Link key={link.path} to={link.path} className="footer__link">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Categorías */}
          <div className="footer__section">
            <h4 className="footer__title">Categorías</h4>
            <nav className="footer__nav">
              <Link to="/tienda?cat=Cuadernillos" className="footer__link">Cuadernillos</Link>
              <Link to="/tienda?cat=Juegos" className="footer__link">Juegos</Link>
              <Link to="/tienda?cat=Agenda" className="footer__link">Agenda</Link>
              <Link to="/tienda?cat=Calendario+y+Efemérides" className="footer__link">Efemérides</Link>
            </nav>
          </div>

          {/* Contacto */}
          <div className="footer__section">
            <h4 className="footer__title">Contacto</h4>
            <div className="footer__nav">
              <a href={`mailto:${SITE_CONFIG.email}`} className="footer__link footer__link--icon">
                <FiMail size={16} /> {SITE_CONFIG.email}
              </a>
              {SITE_CONFIG.socialMedia.instagram && (
                <a href={SITE_CONFIG.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="footer__link footer__link--icon">
                  <FiInstagram size={16} /> @esiensecundaria
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            © {new Date().getFullYear()} {SITE_CONFIG.name}. Todos los derechos reservados.
          </p>
          <p className="footer__powered">
            Powered by{' '}
            <a
              href="https://nilotech.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer__powered-link"
            >
              NiloTech
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
