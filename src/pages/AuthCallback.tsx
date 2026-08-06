import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let processed = false;

    const processUser = async (user: any) => {
      if (processed) return;
      processed = true;

      try {
        const email = user.email || '';
        const metadata = user.user_metadata || {};

        // Check if profile exists
        const { data: existingProfile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileFetchError) {
          console.error("Error checking profile in auth callback:", profileFetchError);
        }

        if (!existingProfile) {
          // Create profile using upsert to avoid duplicate key conflicts
          const displayName = metadata.full_name || metadata.name || metadata.preferred_username || email.split('@')[0] || 'User';
          const photoURL = metadata.avatar_url || metadata.picture || '';
          const isVerified = true; // Google OAuth users are verified
          
          const { error: upsertError } = await supabase.from('profiles').upsert({
            id: user.id,
            email: email,
            display_name: displayName,
            photo_url: photoURL,
            role: 'user',
            is_verified: isVerified,
            loyalty_points: 0,
            created_at: new Date().toISOString()
          }, { onConflict: 'id' });

          if (upsertError) {
            console.error("Failed to insert/upsert profile in AuthCallback:", upsertError.message, upsertError);
          } else {
            console.log("Successfully created profile for Google OAuth user:", user.id);
          }
        }

        if (mounted) {
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error("Exception in auth callback processUser:", err);
        if (mounted) {
          navigate('/', { replace: true });
        }
      }
    };

    // Subscribe to auth state change (catches implicit hash token exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthCallback onAuthStateChange event:", event, session?.user?.email);
      if (session?.user) {
        await processUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) navigate('/login', { replace: true });
      }
    });

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error("Auth callback getSession error:", error);
        if (mounted) navigate('/login', { replace: true });
        return;
      }

      if (session?.user) {
        await processUser(session.user);
      } else {
        // If URL contains hash/code from OAuth, wait up to 2 seconds for Supabase JS client to parse tokens
        const hasAuthParams = window.location.hash.includes('access_token') || window.location.search.includes('code');
        if (!hasAuthParams) {
          if (mounted) navigate('/login', { replace: true });
        } else {
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user) {
              await processUser(retrySession.user);
            } else if (mounted) {
              navigate('/login', { replace: true });
            }
          }, 2000);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-rose-600 animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Authenticating...</h2>
        <p className="text-sm text-slate-500">Please wait while we complete your sign in.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
