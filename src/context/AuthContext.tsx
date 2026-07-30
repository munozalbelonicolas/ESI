import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile } from '../services/authService';
import type { AppUser } from '../types/user';

interface AuthContextType {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isEmailVerified: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (user: User | null) => {
    if (user) {
      try {
        const p = await getUserProfile(user.uid);
        setProfile(p);
      } catch (e) {
        console.warn('[AuthContext] No se pudo cargar el perfil:', e);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(
        auth,
        async (user) => {
          setFirebaseUser(user);
          await loadProfile(user);
          setLoading(false);
        },
        (err) => {
          console.warn('[AuthContext] Error en auth listener:', err);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn('[AuthContext] Excepción al suscribir auth:', err);
      setLoading(false);
    }
    return () => unsub();
  }, []);

  const refreshProfile = async () => {
    if (firebaseUser) {
      try {
        await firebaseUser.reload();
        setFirebaseUser({ ...firebaseUser });
        await loadProfile(firebaseUser);
      } catch (e) {
        console.warn('[AuthContext] Error refrescando perfil:', e);
      }
    }
  };

  const value: AuthContextType = {
    firebaseUser,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isEmailVerified: firebaseUser?.emailVerified ?? false,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
