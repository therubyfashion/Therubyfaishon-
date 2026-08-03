import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, RefreshCw, LogOut, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyPrompt() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  const hasNavigatedRef = useRef(false);
  const authSubRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const uidParam = params.get('uid');
    const msgParam = params.get('message');
    
    if (emailParam) setEmail(emailParam);
    if (uidParam) setUid(uidParam);
    if (msgParam) setUrlMessage(msgParam);

    const fetchSettings = async () => {
      try {
        const configRes = await fetch('/api/payment-config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setStoreSettings({
            storeName: 'The Ruby Fashion',
            storeLogo: 'https://cdn-icons-png.flaticon.com/512/2909/2909813.png',
            ...configData
          });
        }
      } catch (error: any) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    const cleanupSub = () => {
      if (authSubRef.current) {
        authSubRef.current.unsubscribe();
        authSubRef.current = null;
      }
    };

    // Check if user is already verified and has active session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (hasNavigatedRef.current) return;

      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_verified')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (profileData?.is_verified && !hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          cleanupSub();
          await refreshProfile();
          navigate('/', { replace: true });
        }
      } else {
        if (!emailParam && !uidParam && !hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          cleanupSub();
          navigate('/signup', { replace: true });
        }
      }
    });

    authSubRef.current = subscription;

    return () => {
      cleanupSub();
    };
  }, [location, navigate, refreshProfile]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error("Please enter the full 6-digit code.");
      return;
    }

    setVerifying(true);
    try {
      const currentSettings = storeSettings || await fetch('/api/payment-config').then(res => res.ok ? res.json() : null);

      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue })
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        toast.error(errData.error || "Verification code not found or invalid. Please try resending.");
        setVerifying(false);
        return;
      }

      if (hasNavigatedRef.current) return;

      // Immediately stop active auth state listeners & mark navigated
      if (authSubRef.current) {
        authSubRef.current.unsubscribe();
        authSubRef.current = null;
      }
      hasNavigatedRef.current = true;

      let activeUid = uid;
      let firstName = 'Gorgeous';
      let userEmail = email;

      const profileQuery = uid 
        ? supabase.from('profiles').select('id, display_name, email').eq('id', uid).maybeSingle()
        : supabase.from('profiles').select('id, display_name, email').eq('email', email.toLowerCase().trim()).maybeSingle();

      const { data: profileData } = await profileQuery;
      
      if (profileData) {
        activeUid = profileData.id;
        firstName = profileData.display_name?.split(' ')[0] || 'Gorgeous';
        userEmail = profileData.email || email;
      }

      // Sync with Supabase profiles table
      try {
        if (activeUid) {
          await supabase
            .from('profiles')
            .update({ is_verified: true })
            .eq('id', activeUid);
        }
      } catch (supabaseErr) {
        console.error("Failed to update Supabase verification state:", supabaseErr);
      }

      // Immediately update local AuthContext profile state before navigating
      await refreshProfile();

      // Send Welcome Email (non-blocking)
      const welcomeHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${currentSettings?.storeName || 'The Ruby'}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background-color: #FAFAFA; font-family: 'Inter', sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
              <tr>
                <td align="center" style="padding: 60px 0;">
                  <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); border: 1px solid #F1F5F9;">
                    <!-- Brand Header -->
                    <tr>
                      <td align="center" style="padding: 50px 40px 30px 40px; background: linear-gradient(to bottom, #FFF1F2 0%, #ffffff 100%);">
                        ${currentSettings?.storeLogo ? 
                          `<img src="${currentSettings.storeLogo}" alt="${currentSettings.storeName}" style="max-height: 60px; display: block;">` : 
                          `<h1 style="margin: 0; color: #1A2C54; font-size: 32px; font-weight: 800; letter-spacing: -1.5px; text-transform: uppercase;">THE <span style="color: #E11D48; font-style: italic;">RUBY</span></h1>`
                        }
                      </td>
                    </tr>
                    
                    <!-- Hero Section -->
                    <tr>
                      <td style="padding: 20px 60px 40px 60px; text-align: center;">
                        <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
                        <h2 style="margin: 0 0 16px 0; color: #1A2C54; font-size: 28px; font-weight: 700; line-height: 1.2;">You're In, ${firstName}!</h2>
                        <p style="margin: 0; color: #64748B; font-size: 16px; line-height: 1.6;">Your account is now verified. Get ready to explore the most curated fashion collections designed just for you.</p>
                      </td>
                    </tr>

                    <!-- Action Button -->
                    <tr>
                      <td align="center" style="padding: 0 60px 50px 60px;">
                        <a href="${window.location.origin}" style="display: inline-block; background-color: #1A2C54; color: #ffffff; padding: 20px 45px; border-radius: 18px; text-decoration: none; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 25px rgba(26,44,84,0.2);">Start Shopping Now</a>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 50px 60px; background-color: #1A2C54; text-align: center;">
                        <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Welcome to the Family!</p>
                        <p style="margin: 10px 0 0 0; color: #FB7185; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Team ${currentSettings?.storeName || 'The Ruby Fashion'}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          fromName: currentSettings?.storeName || 'The Ruby',
          subject: `Welcome to the Family, ${firstName}! ✨`,
          html: welcomeHtml
        })
      }).catch(err => console.error("Welcome email error:", err));

      toast.success("Account Created Successfully 🎉", { position: 'bottom-center', duration: 5000 });

      // Trigger Welcome Push Notification (Delayed to allow OneSignal to sync)
      setTimeout(() => {
        try {
          fetch('/api/send-user-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: activeUid,
              title: `Welcome to the Family! ✨`,
              body: `Hi ${firstName}, we're so glad you're here!`,
              url: '/'
            })
          });
        } catch (e) {
          console.error("Welcome push error:", e);
        }
      }, 3000);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        navigate('/', { replace: true });
      } else {
        toast.success("Account verified successfully! Please sign in to explore. ✨", { position: 'bottom-center', duration: 5000 });
        navigate('/login', { replace: true });
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error("Failed to verify code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !uid) {
      toast.error("Missing user information. Please try signing up again.");
      return;
    }

    setLoading(true);
    try {
      const currentSettings = storeSettings || await fetch('/api/payment-config').then(res => res.ok ? res.json() : null);

      // Securely generate and store OTP via backend (uses service role key to bypass RLS)
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });

      if (!otpRes.ok) {
        const errData = await otpRes.json();
        throw new Error(errData.error || "Failed to generate verification code securely.");
      }

      toast.success("A new verification code has been sent to your email!");

      toast.success("New verification code sent!");
    } catch (error: any) {
      console.error("Resend error:", error);
      if (error.code === 'not-found' || error.message?.includes('5 NOT_FOUND')) {
        toast.error("The database is preparing. Please try again in a moment! 💎", { duration: 6000 });
      } else {
        toast.error(error.message || "Failed to resend code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAFA] py-12 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ruby/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 relative z-10 text-center flex flex-col items-center"
      >
        {/* Internal Back Button */}
        <button 
          onClick={handleSignOut}
          className="absolute top-6 left-6 p-2 rounded-xl text-gray-400 hover:text-ruby hover:bg-ruby/5 transition-all outline-none"
          title="Go back and change email"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="mb-8">
          <div className="w-20 h-20 bg-ruby/10 text-ruby rounded-3xl flex items-center justify-center mx-auto">
            <Mail size={40} />
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-[#1A2C54]">
            Verify Your <span className="text-ruby italic">Email</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            We've sent a 6-digit code to <span className="text-[#1A2C54] font-bold">{email}</span>. 
            Enter it below to activate your account.
          </p>
        </div>

        {/* OTP Input Group */}
        <div className="flex justify-center gap-2 mb-10">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"
            />
          ))}
        </div>

        <div className="space-y-4 w-full">
          <button 
            onClick={handleVerifyOtp}
            disabled={verifying}
            className="w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-[13px] font-black uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-[#1A2C54]/30 flex items-center justify-center gap-3 disabled:opacity-50 relative overflow-hidden group border-b-4 border-black/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {verifying ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Verify & Activate</span>
                <CheckCircle2 size={18} className="relative z-10" />
              </>
            )}
          </button>

          <button 
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-white border-2 border-ruby/20 text-ruby py-5 rounded-2xl text-[13px] font-black uppercase tracking-[0.2em] hover:bg-ruby/5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group shadow-lg shadow-ruby/5"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                Resend Verification Code
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              </>
            )}
          </button>
        </div>

        <div className="pt-8">
          <p className="text-[10px] text-gray-300 uppercase tracking-[0.3em] font-bold flex items-center justify-center gap-2">
            <Sparkles size={12} className="text-ruby" />
            The Ruby Premium Experience
          </p>
        </div>
      </motion.div>
    </div>
  );
}
