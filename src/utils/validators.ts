/** Valida un email */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valida que la contraseña tenga al menos 6 caracteres */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 6;
}

/** Genera un slug URL-friendly a partir de un string */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Valida un código postal argentino (4 dígitos) */
export function isValidZipCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

/** Trunca un texto a N caracteres con ellipsis */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}
