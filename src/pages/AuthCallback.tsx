import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const finalizeRedirect = (destination: string) => {
      if (handled.current) return;
      handled.current = true;
      toast.success("Welcome! Successfully signed in.");
      // Use window.location.replace to guarantee immediate hard redirect and clean URL state
      window.location.replace(destination);
    };

    const handleAuth = async (session: any) => {
      if (handled.current) return;
      const user = session?.user;
      if (!user) {
        finalizeRedirect('/');
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: 'user',
            is_verified: true,
            photo_url: user.user_metadata?.avatar_url || null,
            loyalty_points: 0
          }, { onConflict: 'id' });
        }

        const target = profile?.role === 'admin' ? '/admin' : '/';
        finalizeRedirect(target);
      } catch (err) {
        console.error("AuthCallback handleAuth exception:", err);
        finalizeRedirect('/');
      }
    };

    // 1. Primary: Manual code exchange if ?code= is present in URL
    const tryCodeExchange = async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            await handleAuth(data.session);
            return true;
          }
        } catch (e) {
          console.error("Code exchange exception:", e);
        }
      }
      return false;
    };

    // 2. Primary fallback: onAuthStateChange listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled.current) return;
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          subscription.unsubscribe();
          await handleAuth(session);
        }
      }
    );

    // Run code exchange or check active session
    tryCodeExchange().then(success => {
      if (!success && !handled.current) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user && !handled.current) {
            subscription.unsubscribe();
            handleAuth(session);
          }
        });
      }
    });

    // 3. Fallback safety timer - redirect after 3 seconds max so page NEVER stays stuck on /auth/callback
    const timeout = setTimeout(() => {
      if (!handled.current) {
        subscription.unsubscribe();
        finalizeRedirect('/');
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Signing you in...
        </p>
      </div>
    </div>
  );
}
