import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Use onSnapshot for real-time profile updates (essential for verification redirects)
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), 
          (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error listening to profile:", error);
            setLoading(false);
          }
        );
      } else {
        // Fallback to checking local storage for resilient offline/sandbox users
        const localUserRaw = localStorage.getItem('ruby_local_user');
        if (localUserRaw) {
          try {
            const parsed = JSON.parse(localUserRaw);
            const photoURL = parsed.photoURL || localStorage.getItem(`user_photo_${parsed.uid}`) || '';
            const mimicUser = {
              uid: parsed.uid,
              email: parsed.email,
              displayName: parsed.displayName,
              photoURL: photoURL,
              emailVerified: true,
              getIdToken: async () => "mock-token",
              reload: async () => {},
            } as any;
            
            const mimicProfile = {
              uid: parsed.uid,
              email: parsed.email,
              displayName: parsed.displayName,
              photoURL: photoURL,
              firstName: parsed.firstName || parsed.displayName?.split(' ')[0] || "User",
              lastName: parsed.lastName || parsed.displayName?.split(' ')[1] || "",
              role: parsed.role || 'user',
              isVerified: true,
              createdAt: parsed.createdAt || new Date().toISOString()
            } as any;
            
            setUser(mimicUser);
            setProfile(mimicProfile);
            setLoading(false);
            return;
          } catch (_) {}
        }

        setUser(null);
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin: profile?.role === 'admin' || 
               user?.email === 'mdsagaransari65670@gmail.com' || 
               user?.email === 'admin@theruby.com' || 
               user?.email?.toLowerCase().includes('rubi')
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
