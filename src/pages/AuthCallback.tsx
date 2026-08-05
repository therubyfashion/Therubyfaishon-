import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback session error:", error);
          navigate('/login', { replace: true });
          return;
        }

        if (session && session.user) {
          const user = session.user;
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
            // Create profile
            const displayName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
            const isVerified = (metadata.iss === 'https://accounts.google.com' || metadata.provider === 'google' || metadata.avatar_url) ? true : false;
            
            await supabase.from('profiles').insert({
              id: user.id,
              email: email,
              display_name: displayName,
              role: 'user',
              is_verified: isVerified,
              loyalty_points: 0,
              created_at: new Date().toISOString()
            });
          }

          // Redirect to home
          navigate('/', { replace: true });
        } else {
          // No session
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error("Exception in auth callback:", err);
        navigate('/login', { replace: true });
      }
    };

    handleAuthCallback();
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
