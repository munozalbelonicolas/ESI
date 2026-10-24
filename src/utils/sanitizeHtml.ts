import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML enriquecido (descripciones de productos, posts del blog) antes de
 * renderizarlo con dangerouslySetInnerHTML. Lista permitida estricta: sin scripts,
 * iframes, formularios ni atributos de evento; enlaces solo http(s)/mailto/tel.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class', 'style'];

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  // Todo enlace abre sin acceso a window.opener
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      if (node.getAttribute('target')) node.setAttribute('target', '_blank');
    }
  });
}

export function sanitizeHtml(dirty: string | undefined | null): string {
  ensureHooks();
  return DOMPurify.sanitize(dirty || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|webp|gif);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
