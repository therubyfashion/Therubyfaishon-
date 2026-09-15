import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const handleAuth = async (session: any) => {
      if (handled.current) return;
      handled.current = true;
      const user = session.user;
      try {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: 'user',
            is_verified: true,
            photo_url: user.user_metadata?.avatar_url || null,
            loyalty_points: 0
          });
        }
        navigate(profile?.role === 'admin' ? '/admin' : '/', { replace: true });
      } catch {
        navigate('/', { replace: true });
      }
    };

    // PRIMARY: Try manual code exchange first
    const tryCodeExchange = async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            await handleAuth(data.session);
            return true;
          }
          console.error('Code exchange error:', error);
        } catch (e) {
          console.error('Code exchange exception:', e);
        }
      }
      return false;
    };

    // FALLBACK: onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled.current) return;
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          handled.current = true;
          subscription.unsubscribe();
          await handleAuth(session);
        }
      }
    );

    // Run
    tryCodeExchange().then(success => {
      if (!success) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && !handled.current) {
            handled.current = true;
            subscription.unsubscribe();
            handleAuth(session);
          }
        });
      }
    });

    const timeout = setTimeout(() => {
      if (!handled.current) {
        handled.current = true;
        subscription.unsubscribe();
        navigate('/', { replace: true });
      }
    }, 10000);

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [navigate]);

  return null;
}
