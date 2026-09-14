import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const handleAuth = async (session: any) => {
      if (handled.current) return;
      handled.current = true;

      if (!session?.user) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!profile) {
          await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            display_name: session.user.user_metadata?.full_name ||
                         session.user.user_metadata?.name ||
                         session.user.email?.split('@')[0],
            role: 'user',
            is_verified: true,
            photo_url: session.user.user_metadata?.avatar_url || null
          });
        }

        navigate(profile?.role === 'admin' ? '/admin' : '/', { replace: true });
      } catch {
        navigate('/', { replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          await handleAuth(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        handleAuth(session);
      }
    });

    const timeout = setTimeout(() => {
      if (!handled.current) {
        handled.current = true;
        subscription.unsubscribe();
        navigate('/', { replace: true });
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Completely invisible — no UI at all
  return null;
}

