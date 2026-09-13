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

  const fetchProfile = async (userId: string, email: string, metadata: any, sessionUser?: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Supabase profile in AuthContext:", error);
      }

      // Check if user is authenticated via Google or has confirmed email
      const isGoogleUser = Boolean(
        metadata?.iss === 'https://accounts.google.com' || 
        metadata?.provider === 'google' || 
        metadata?.avatar_url || 
        metadata?.picture ||
        sessionUser?.app_metadata?.provider === 'google' ||
        sessionUser?.app_metadata?.providers?.includes('google') ||
        sessionUser?.email_confirmed_at
      );

      if (data) {
        const isVerified = Boolean(data.is_verified || isGoogleUser);

        // Auto-heal is_verified in Supabase profiles if user is Google-authenticated
        if (!data.is_verified && isGoogleUser) {
          supabase.from('profiles').update({ is_verified: true }).eq('id', userId).then();
        }

        setProfile({
          uid: data.id,
          email: data.email,
          displayName: data.display_name || metadata?.full_name || metadata?.name || data.email.split('@')[0] || 'User',
          phoneNumber: data.phone_number || '',
          photoURL: data.photo_url || metadata?.avatar_url || metadata?.picture || '',
          phoneVerified: true,
          role: data.role || 'user',
          isVerified: isVerified,
          loyaltyPoints: data.loyalty_points || 0,
          onesignalId: data.onesignal_id || null,
          createdAt: data.created_at || new Date().toISOString()
        } as UserProfile);
      } else {
        // Fallback or OAuth auto-profile creation
        const displayName = metadata?.full_name || metadata?.name || email.split('@')[0] || 'User';
        const photoUrl = metadata?.avatar_url || metadata?.picture || '';
        const isVerified = isGoogleUser ? true : false;
        const role = 'user'; // Default role for new OAuth/signup users is 'user'. Admin role must be assigned in database profiles.role

        const newProfile: UserProfile = {
          uid: userId,
          email: email,
          displayName: displayName,
          photoURL: photoUrl,
          role: role,
          isVerified: isVerified,
          loyaltyPoints: 0,
          createdAt: new Date().toISOString()
        };

        setProfile(newProfile);

        // Create the profile in the profiles table
        try {
          const { error: insertErr } = await supabase.from('profiles').insert({
            id: userId,
            email: email,
            display_name: displayName,
            role: role,
            is_verified: isVerified,
            photo_url: photoUrl || null,
            loyalty_points: 0,
            created_at: newProfile.createdAt
          });
          if (insertErr) {
            console.error("Error inserting fallback profile in AuthContext:", insertErr);
          } else {
            console.log("Successfully created profile in AuthContext for user:", userId);
          }
        } catch (insertErr) {
          console.error("Exception inserting fallback profile in AuthContext:", insertErr);
        }
      }
    } catch (err) {
      console.error("Exception in fetchProfile in AuthContext:", err);
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
      await fetchProfile(sUser.id, sUser.email || "", sUser.user_metadata, sUser);
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
      const sUser = session.user;
      const userCompat = {
        ...sUser,
        uid: sUser.id,
        emailVerified: sUser.email_confirmed_at ? true : false,
        reload: async () => {},
        getIdToken: async () => session.access_token || ""
      };
      setUser(userCompat);
      await fetchProfile(sUser.id, sUser.email || "", sUser.user_metadata, sUser);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      refreshProfile,
      isAdmin: profile?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

