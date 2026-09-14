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

export const isGoogleAuthUser = (sessionUser?: any, metadata?: any): boolean => {
  const appMeta = sessionUser?.app_metadata || {};
  const userMeta = metadata || sessionUser?.user_metadata || {};
  const identities = sessionUser?.identities || [];
  
  return Boolean(
    appMeta.provider === 'google' ||
    (Array.isArray(appMeta.providers) && appMeta.providers.includes('google')) ||
    (Array.isArray(identities) && identities.some((i: any) => i.provider === 'google')) ||
    userMeta.provider === 'google' ||
    userMeta.iss === 'https://accounts.google.com' ||
    (typeof userMeta.iss === 'string' && userMeta.iss.includes('accounts.google.com')) ||
    Boolean(userMeta.avatar_url && userMeta.email_verified) ||
    Boolean(userMeta.picture && userMeta.email_verified)
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string, metadata: any, sessionUser?: any) => {
    try {
      const isGoogle = isGoogleAuthUser(sessionUser, metadata);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Supabase profile in AuthContext:", error);
      }

      if (data) {
        // If provider === 'google', SKIP the is_verified check entirely and treat them as verified
        const isVerified = isGoogle ? true : Boolean(data.is_verified);

        // Auto-heal is_verified in Supabase profiles if user is Google-authenticated
        if (!data.is_verified && isGoogle) {
          supabase.from('profiles').update({ is_verified: true }).eq('id', userId).then(({ error: healErr }) => {
            if (healErr) {
              console.error("AuthContext: Error auto-healing profile is_verified:", healErr);
            } else {
              console.log("AuthContext: Successfully auto-healed is_verified for Google user:", userId);
            }
          });
        }

        setProfile({
          uid: data.id,
          email: data.email,
          displayName: data.display_name || metadata?.full_name || metadata?.name || data.email?.split('@')[0] || 'User',
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
        // Fallback or OAuth inline profile creation:
        // Prevent race condition if AuthCallback hasn't finished inserting yet.
        // Google OAuth users get is_verified = true immediately, never redirecting to login.
        console.log("AuthContext: Profile does not exist yet. Creating profile inline for user:", userId, "isGoogle:", isGoogle);
        const displayName = metadata?.full_name || metadata?.name || email?.split('@')[0] || 'User';
        const photoUrl = metadata?.avatar_url || metadata?.picture || '';
        const isVerified = isGoogle ? true : false;
        const role = 'user';

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

        // Immediately set profile in state so no route guard or null check redirects to login/verify
        setProfile(newProfile);

        // Create the profile in the profiles table with upsert on conflict 'id'
        try {
          const { data: upsertData, error: insertErr } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              email: email,
              display_name: displayName,
              role: role,
              is_verified: isVerified,
              photo_url: photoUrl || null,
              loyalty_points: 0,
              created_at: newProfile.createdAt
            }, { onConflict: 'id' })
            .select()
            .maybeSingle();

          if (insertErr) {
            console.error("AuthContext: Error upserting inline profile in Supabase:", insertErr);
          } else {
            console.log("AuthContext: Successfully created inline profile in Supabase for user:", userId, upsertData);
          }
        } catch (insertErr) {
          console.error("AuthContext: Exception creating inline profile in Supabase:", insertErr);
        }
      }
    } catch (err) {
      console.error("Exception in fetchProfile in AuthContext:", err);
    }
  };

  const handleSession = async (session: any) => {
    if (session?.user) {
      const sUser = session.user;
      const isGoogle = isGoogleAuthUser(sUser, sUser.user_metadata);
      const userCompat = {
        ...sUser,
        uid: sUser.id,
        emailVerified: isGoogle ? true : Boolean(sUser.email_confirmed_at),
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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("AuthContext: getSession error on init:", error);
      }
      handleSession(session);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext: onAuthStateChange event:", event, "userId:", session?.user?.id);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        // When SIGNED_IN or other events fire for a Google user, process session and do NOT sign out or redirect to login
        await handleSession(session);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
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

