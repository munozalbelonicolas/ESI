import { Timestamp } from 'firebase/firestore';

/**
 * Formatea un Timestamp de Firestore a fecha legible.
 * Ej: "15 de marzo de 2026"
 */
export function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formatea un Timestamp de Firestore a fecha corta.
 * Ej: "15/03/2026"
 */
export function formatDateShort(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formatea un Timestamp a fecha + hora.
 */
export function formatDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const date = ts.toDate();
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
