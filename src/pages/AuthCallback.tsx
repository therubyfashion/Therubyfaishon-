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
        navigate('/login', { replace: true });
        return;
      }

      try {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!profile) {
          // Create profile for new Google OAuth user
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
          navigate('/', { replace: true });
        } else {
          navigate(profile.role === 'admin' ? '/admin' : '/', { replace: true });
        }
      } catch (err) {
        console.error('Profile error:', err);
        navigate('/', { replace: true });
      }
    };

    // Listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email);
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          await handleAuth(session);
        }
      }
    );

    // Also check existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Existing session:', session?.user?.email);
      if (session) {
        subscription.unsubscribe();
        handleAuth(session);
      }
    });

    // Longer timeout — 10 seconds
    const timeout = setTimeout(() => {
      if (!handled.current) {
        console.log('Timeout — no auth event received');
        subscription.unsubscribe();
        // Don't go to login — go to home and let AuthContext handle it
        navigate('/', { replace: true });
      }
    }, 10000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '16px',
      background: '#fff'
    }}>
      <div style={{
        width: '48px',
        height: '48px', 
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #A11B35',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: '#333', fontFamily: 'sans-serif', fontSize: '16px', fontWeight: '500' }}>
        Completing sign in...
      </p>
      <p style={{ color: '#999', fontFamily: 'sans-serif', fontSize: '13px' }}>
        Please wait a moment
      </p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
