import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
auth.languageCode = 'es'; // Configurar correos de verificación y reseteo en Español

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
