import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      try {
        let session = null;
        
        // 1. Try exchanging code for session if auth params/code are present in URL
        if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (!error && data?.session) {
            session = data.session;
          } else if (error) {
            console.warn('exchangeCodeForSession warning:', error.message);
          }
        }

        // 2. If exchange did not return session directly (e.g. auto-exchanged or session already active), fallback to getSession
        if (!session) {
          const { data: sessionData } = await supabase.auth.getSession();
          session = sessionData?.session;
        }

        if (!session) {
          console.error('Auth callback: No active session found');
          if (mounted) navigate('/login', { replace: true });
          return;
        }

        const user = session.user;

        // 3. Check if user profile exists in database
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          // Create profile for Google OAuth user
          const displayName = user.user_metadata?.full_name || 
                               user.user_metadata?.name || 
                               user.user_metadata?.preferred_username ||
                               user.email?.split('@')[0] || 'User';
          const photoURL = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            display_name: displayName,
            photo_url: photoURL,
            role: 'user',
            is_verified: true,
            loyalty_points: 0,
            created_at: new Date().toISOString()
          }, { onConflict: 'id' });

          if (mounted) navigate('/', { replace: true });
        } else {
          // Route based on role
          if (mounted) {
            navigate(profile.role === 'admin' ? '/admin' : '/', { replace: true });
          }
        }
      } catch (err) {
        console.error('Callback error:', err);
        if (mounted) navigate('/login', { replace: true });
      }
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-rose-600 animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Completing sign in...</h2>
        <p className="text-sm text-slate-500">Please wait while we log you in.</p>
      </div>
    </div>
  );
}
