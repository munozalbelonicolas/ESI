import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppUser } from '../types/user';

/**
 * Registra un nuevo usuario con email y contraseña.
 * Crea además su documento en la colección "users" de Firestore.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string,
  phone: string = ''
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Crear documento en Firestore
  await setDoc(doc(db, 'users', user.uid), {
    email,
    displayName,
    phone,
    role: 'customer',
    emailVerified: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Enviar email de verificación
  await sendEmailVerification(user);

  return user;
}

/**
 * Inicia sesión con email y contraseña.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Envía un email de restablecimiento de contraseña.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Obtiene el perfil del usuario desde Firestore.
 */
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AppUser;
}

/**
 * Verifica si el usuario tiene rol de admin.
 */
export async function isAdmin(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === 'admin';
}
