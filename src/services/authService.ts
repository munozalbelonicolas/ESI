import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { AppUser } from '../types/user';
import type { ShippingAddress } from '../types/order';

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
 * Actualiza el perfil del usuario en Firestore y en Firebase Auth.
 */
export async function updateUserProfile(
  uid: string,
  data: {
    displayName?: string;
    phone?: string;
    avatarUrl?: string;
    shippingAddress?: ShippingAddress;
  }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, {
      displayName: data.displayName ?? auth.currentUser.displayName,
      photoURL: data.avatarUrl ?? auth.currentUser.photoURL,
    });
  }
}

/**
 * Verifica si el usuario tiene rol de admin.
 */
export async function isAdmin(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === 'admin';
}
