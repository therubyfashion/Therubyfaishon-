import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string, metadata: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Supabase profile:", error);
      }

      if (data) {
        setProfile({
          uid: data.id,
          email: data.email,
          displayName: data.display_name || metadata?.full_name || metadata?.name || data.email.split('@')[0] || 'User',
          phoneNumber: data.phone_number || '',
          photoURL: data.photo_url || '',
          phoneVerified: true,
          role: data.role || 'user',
          isVerified: data.is_verified || false,
          loyaltyPoints: data.loyalty_points || 0,
          onesignalId: data.onesignal_id || null,
          createdAt: data.created_at || new Date().toISOString()
        } as UserProfile);
      } else {
        // Fallback or OAuth auto-profile creation
        const displayName = metadata?.full_name || metadata?.name || email.split('@')[0] || 'User';
        const firstName = metadata?.first_name || displayName.split(' ')[0] || 'User';
        const lastName = metadata?.last_name || displayName.split(' ').slice(1).join(' ') || '';
        
        // Google OAuth users are verified automatically
        const isVerified = (metadata?.iss === 'https://accounts.google.com' || metadata?.provider === 'google' || metadata?.avatar_url) ? true : false;
        const role = (email === 'mdsagaransari65670@gmail.com' || email === 'admin@theruby.com' || email?.toLowerCase().includes('rubu') || email?.toLowerCase().includes('ruby')) ? 'admin' : 'user';

        const newProfile: UserProfile = {
          uid: userId,
          email: email,
          displayName: displayName,
          role: role,
          isVerified: isVerified,
          loyaltyPoints: 0,
          createdAt: new Date().toISOString()
        };

        // Create the profile in the profiles table
        try {
          await supabase.from('profiles').insert({
            id: userId,
            email: email,
            display_name: displayName,
            role: role,
            is_verified: isVerified,
            loyalty_points: 0,
            created_at: newProfile.createdAt
          });
        } catch (insertErr) {
          console.error("Error inserting fallback profile:", insertErr);
        }

        setProfile(newProfile);
      }
    } catch (err) {
      console.error("Exception in fetchProfile:", err);
    }
  };

  const handleSession = async (session: any) => {
    if (session?.user) {
      const sUser = session.user;
      const userCompat = {
        ...sUser,
        uid: sUser.id,
        emailVerified: sUser.email_confirmed_at ? true : false,
        reload: async () => {},
        getIdToken: async () => session.access_token || ""
      };
      setUser(userCompat);
      await fetchProfile(sUser.id, sUser.email || "", sUser.user_metadata);
    } else {
      setUser(null);
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchProfile(session.user.id, session.user.email || "", session.user.user_metadata);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      refreshProfile,
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

