import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    // Check for errors returned in query string or hash fragment by OAuth provider
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const urlError = searchParams.get('error') || hashParams.get('error');
      const urlErrorDesc = searchParams.get('error_description') || hashParams.get('error_description');
      const urlErrorCode = searchParams.get('error_code') || hashParams.get('error_code');
      if (urlError || urlErrorDesc || urlErrorCode) {
        console.error("AuthCallback: OAuth URL error reported by provider:", {
          error: urlError,
          description: urlErrorDesc,
          code: urlErrorCode,
          search: window.location.search,
          hash: window.location.hash
        });
      }
    } catch (paramErr: any) {
      console.error("AuthCallback: Error parsing URL parameters:", paramErr?.message, paramErr);
    }

    const handleAuth = async (session: any) => {
      if (handled.current) return;
      handled.current = true;

      if (!session?.user) {
        console.error("AuthCallback: handleAuth called with null or invalid session/user:", session);
        navigate('/', { replace: true });
        return;
      }

      const sUser = session.user;
      console.log("AuthCallback: Processing authenticated session for user:", sUser.id, sUser.email);

      try {
        // Query existing profile using maybeSingle to avoid 0-row errors
        const { data: profile, error: profileFetchErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sUser.id)
          .maybeSingle();

        if (profileFetchErr) {
          console.error("AuthCallback: Error querying profiles table from Supabase:", profileFetchErr.message, profileFetchErr);
        }

        let userRole = profile?.role || 'user';

        if (!profile) {
          console.log("AuthCallback: Profile does not exist in database. Inserting new verified profile for Google user...");
          const displayName = sUser.user_metadata?.full_name ||
            sUser.user_metadata?.name ||
            sUser.email?.split('@')[0] ||
            'User';
          const photoUrl = sUser.user_metadata?.avatar_url || sUser.user_metadata?.picture || null;

          const newProfilePayload = {
            id: sUser.id,
            email: sUser.email,
            display_name: displayName,
            role: 'user',
            is_verified: true,
            photo_url: photoUrl,
            loyalty_points: 0,
            created_at: new Date().toISOString()
          };

          const { data: insertedData, error: insertErr } = await supabase
            .from('profiles')
            .upsert(newProfilePayload, { onConflict: 'id' })
            .select()
            .maybeSingle();

          if (insertErr) {
            console.error("AuthCallback: Failed to insert new profile for Google user:", insertErr.message, insertErr);
          } else {
            console.log("AuthCallback: Successfully created verified profile for Google user:", insertedData);
          }
        } else {
          console.log("AuthCallback: Existing profile found:", { id: profile.id, role: profile.role, is_verified: profile.is_verified });
          if (!profile.is_verified) {
            console.log("AuthCallback: Existing profile has is_verified=false. Auto-healing to true for Google user...");
            const { error: updateErr } = await supabase
              .from('profiles')
              .update({ is_verified: true })
              .eq('id', sUser.id);
            if (updateErr) {
              console.error("AuthCallback: Failed to auto-heal is_verified in profiles table:", updateErr.message, updateErr);
            } else {
              console.log("AuthCallback: Successfully marked existing profile as is_verified=true");
            }
          }
        }

        // Refresh profile in AuthContext
        try {
          await refreshProfile();
        } catch (rErr: any) {
          console.error("AuthCallback: Failed refreshing AuthContext profile:", rErr?.message, rErr);
        }

        const destination = userRole === 'admin' ? '/admin' : '/';
        console.log("AuthCallback: Navigating to destination:", destination);
        navigate(destination, { replace: true });
      } catch (fatalErr: any) {
        console.error("AuthCallback: Fatal exception during handleAuth:", fatalErr?.message, fatalErr);
        navigate('/', { replace: true });
      }
    };

    // Check if authorization code is present for PKCE flow
    const checkAndExchangeCode = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          console.log("AuthCallback: Detected 'code' query parameter, exchanging for session...");
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.error("AuthCallback: exchangeCodeForSession failed:", exchangeErr.message, exchangeErr);
          } else if (data?.session) {
            console.log("AuthCallback: exchangeCodeForSession succeeded with user:", data.session.user.id);
            await handleAuth(data.session);
            return true;
          }
        }
      } catch (exErr: any) {
        console.error("AuthCallback: Exception while exchanging code for session:", exErr?.message, exErr);
      }
      return false;
    };

    // 1. Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("AuthCallback: onAuthStateChange event received:", event, "hasSession:", Boolean(session?.user));
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          subscription.unsubscribe();
          await handleAuth(session);
        }
      }
    );

    // 2. Perform immediate checks
    (async () => {
      const exchanged = await checkAndExchangeCode();
      if (exchanged) return;

      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.error("AuthCallback: getSession error:", sessionErr.message, sessionErr);
        } else if (session?.user) {
          console.log("AuthCallback: getSession found active session:", session.user.id);
          subscription.unsubscribe();
          await handleAuth(session);
        }
      } catch (getErr: any) {
        console.error("AuthCallback: Exception in getSession:", getErr?.message, getErr);
      }
    })();

    // 3. Fallback timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!handled.current) {
        console.error("AuthCallback: Timeout reached (8s) waiting for session. Navigating to '/'");
        handled.current = true;
        subscription.unsubscribe();
        navigate('/', { replace: true });
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, refreshProfile]);

  // Completely invisible — no UI at all
  return null;
}


