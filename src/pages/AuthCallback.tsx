import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait for Supabase to automatically handle the OAuth callback
        // Supabase JS v2 handles PKCE automatically via onAuthStateChange
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          navigate('/login', { replace: true });
          return;
        }

        if (session?.user) {
          // Session exists — check/create profile
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
          }

          // Route based on role
          const role = profile?.role || 'user';
          navigate(role === 'admin' ? '/admin' : '/', { replace: true });
        } else {
          // No session yet — listen for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (event === 'SIGNED_IN' && session?.user) {
                subscription.unsubscribe();
                
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

                const role = profile?.role || 'user';
                navigate(role === 'admin' ? '/admin' : '/', { replace: true });
              } else if (event === 'SIGNED_OUT') {
                subscription.unsubscribe();
                navigate('/login', { replace: true });
              }
            }
          );

          // Timeout fallback — if nothing happens in 5 seconds, go to login
          setTimeout(() => {
            subscription.unsubscribe();
            navigate('/login', { replace: true });
          }, 5000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
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
      <p style={{ color: '#666', fontFamily: 'sans-serif', fontSize: '16px' }}>
        Completing sign in...
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
