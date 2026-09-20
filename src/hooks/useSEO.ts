import { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_TITLE = 'ESI en Secundaria — Recursos de ESI para Docentes';
const DEFAULT_DESCRIPTION =
  'Recursos, cuadernillos didácticos, secuencias y juegos de Educación Sexual Integral (ESI) para docentes de nivel secundario en Argentina.';
const DEFAULT_IMAGE =
  'https://d22fxaf9t8d39k.cloudfront.net/9f9e8e95da2ed9e665173f111bb758d1dd792087a99ee5cdce9e721472df48a9202263.png';
const SITE_URL = 'https://esiensecundaria.com.ar';

function setMetaTag(nameOrProperty: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${nameOrProperty}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(nameOrProperty, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function useSEO({
  title,
  description,
  canonical,
  image,
  type = 'website',
  keywords,
  jsonLd,
}: SEOProps = {}) {
  useEffect(() => {
    // 1. Título
    const fullTitle = title
      ? title.includes('ESI en Secundaria')
        ? title
        : `${title} | ESI en Secundaria`
      : DEFAULT_TITLE;
    document.title = fullTitle;

    // 2. Meta descripción y palabras clave
    const metaDesc = description || DEFAULT_DESCRIPTION;
    setMetaTag('name', 'description', metaDesc);
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. Canonical URL
    const canonicalUrl = canonical
      ? canonical.startsWith('http')
        ? canonical
        : `${SITE_URL}${canonical}`
      : `${SITE_URL}${window.location.pathname}`;
    setCanonical(canonicalUrl);

    // 4. Open Graph (Facebook, WhatsApp, LinkedIn, Bots de IA)
    const ogImage = image || DEFAULT_IMAGE;
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', metaDesc);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:site_name', 'ESI en Secundaria');

    // 5. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', metaDesc);
    setMetaTag('name', 'twitter:image', ogImage);

    // 6. Structured Data JSON-LD dinámico (Producto / Blog / etc.)
    const scriptId = 'dynamic-seo-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.text = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }

    return () => {
      // Limpiar script JSON-LD dinámico al desmontar
      const dynamicScript = document.getElementById(scriptId);
      if (dynamicScript) {
        dynamicScript.remove();
      }
    };
  }, [title, description, canonical, image, type, keywords, JSON.stringify(jsonLd)]);
}
