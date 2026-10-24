import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isDummyKey = !rawApiKey || rawApiKey === 'your_api_key' || rawApiKey.length < 10;

const firebaseConfig = {
  apiKey: isDummyKey ? 'AIzaSyDemoKeyForLocalDevelopmentESI2026' : rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'esi-secundaria.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'esi-secundaria',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'esi-secundaria.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:1234567890',
};

const useFirebaseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

// Prevent local development from silently reading or writing the production
// Firebase project when emulator configuration is missing.
if (import.meta.env.DEV && !useFirebaseEmulators) {
  throw new Error('Modo local seguro: configurá Firebase Emulator antes de iniciar la aplicación.');
}
if (useFirebaseEmulators && !firebaseConfig.projectId.startsWith('demo-')) {
  throw new Error('Firebase Emulator debe usar un project ID local que comience con "demo-".');
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
auth.languageCode = 'es'; // Configurar correos de verificación y reseteo en Español

export const db = getFirestore(app);
export const storage = getStorage(app);

// Emulator access requires both a development build and an explicit opt-in.
// Production builds can never be redirected to localhost by an env flag.
const emulatorState = globalThis as typeof globalThis & {
  __ESI_FIREBASE_EMULATORS_CONNECTED__?: boolean;
};

if (useFirebaseEmulators && !emulatorState.__ESI_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  emulatorState.__ESI_FIREBASE_EMULATORS_CONNECTED__ = true;
}

export default app;
