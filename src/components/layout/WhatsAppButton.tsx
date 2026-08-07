import { FaWhatsapp } from 'react-icons/fa';
import { SITE_CONFIG } from '../../config/site';
import { trackWhatsAppClick } from '../../config/analytics';
import './WhatsAppButton.css';

export default function WhatsAppButton() {
  const handleClick = () => {
    trackWhatsAppClick(window.location.pathname);
  };

  const message = encodeURIComponent('¡Hola! Vengo desde la web de ESI en Secundaria y quisiera hacer una consulta.');

  return (
    <a
      href={`https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-btn"
      onClick={handleClick}
      aria-label="Contactar por WhatsApp"
      id="whatsapp-button"
    >
      <FaWhatsapp size={28} />
      <span className="whatsapp-btn__text">¿Consultas? ¡Escribinos!</span>
    </a>
  );
}
