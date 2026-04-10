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
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
          const userData = userDoc.data() as UserProfile | undefined;

          if (userDoc.exists()) {
            // If it's an email user, check if they are verified in Firestore
            const isGoogleUser = firebaseUser.providerData.some(p => p.providerId === 'google.com');
            const isPhoneUser = firebaseUser.providerData.some(p => p.providerId === 'phone');
            
            if (!isGoogleUser && !isPhoneUser && !userData?.isVerified) {
              setProfile(null);
              setUser(null);
              await auth.signOut();
            } else {
              setProfile(userData);
            }
          } else if (
            firebaseUser.emailVerified || 
            firebaseUser.providerData.some(p => p.providerId === 'google.com') ||
            firebaseUser.providerData.some(p => p.providerId === 'phone')
          ) {
            // Create profile only if verified, Google, or Phone
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              phoneNumber: firebaseUser.phoneNumber || '',
              role: 'user',
              isVerified: firebaseUser.providerData.some(p => p.providerId === 'phone') ? true : false,
              phoneVerified: firebaseUser.providerData.some(p => p.providerId === 'phone') ? true : false,
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setLoading(false);
        });
      } else {
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
