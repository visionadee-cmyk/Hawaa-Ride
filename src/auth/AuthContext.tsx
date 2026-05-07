import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { auth, db } from '@/src/firebase';

export type UserRole = 'rider' | 'driver' | 'admin';

export type UserDoc = {
  uid: string;
  phoneNumber: string | null;
  role: UserRole | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type AuthContextValue = {
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  role: UserRole | null;
  loading: boolean;
  setRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function upsertUserDoc(u: User) {
  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const newDoc: UserDoc = {
      uid: u.uid,
      phoneNumber: u.phoneNumber ?? null,
      role: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newDoc);
    return newDoc;
  }
  const data = snap.data() as UserDoc;
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      setFirebaseUser(u);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }
      try {
        const docData = await upsertUserDoc(u);
        setUserDoc(docData);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      firebaseUser,
      userDoc,
      role: userDoc?.role ?? null,
      loading,
      setRole: async (role: UserRole) => {
        if (!firebaseUser) throw new Error('Not signed in');
        const ref = doc(db, 'users', firebaseUser.uid);
        const next: Partial<UserDoc> = {
          role,
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, next, { merge: true });
        setUserDoc((prev: UserDoc | null) => (prev ? { ...prev, role } : prev));
      },
      logout: async () => {
        await signOut(auth);
      },
    };
  }, [firebaseUser, loading, userDoc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
