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

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
          const userData = userDoc.data() as UserProfile | undefined;
          if (userDoc.exists()) {
            setProfile(userData);
          }
          setLoading(false);
        });
      } else {
        // Check for phone login fallback
        const phoneUserJson = localStorage.getItem('phone_user');
        if (phoneUserJson) {
          try {
            const phoneUser = JSON.parse(phoneUserJson);
            // We don't have a Firebase User object, but we have the profile
            unsubscribeProfile = onSnapshot(doc(db, 'users', phoneUser.uid), (userDoc) => {
              if (userDoc.exists()) {
                setProfile(userDoc.data() as UserProfile);
              } else {
                localStorage.removeItem('phone_user');
                setProfile(null);
              }
              setLoading(false);
            });
            return;
          } catch (e) {
            localStorage.removeItem('phone_user');
          }
        }
        
        setUser(null);
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
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
               user?.email?.toLowerCase().includes('rubi')
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
