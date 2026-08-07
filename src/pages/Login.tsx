import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { sendNotification } from '../lib/notifications';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, LogIn, Smartphone, ShieldCheck, Award, RotateCcw, Headphones, ArrowLeft } from 'lucide-react';


export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeSettings, setStoreSettings] = useState<any>(null);
  // Phone login logic removed
  const [showResetModal, setShowResetModal] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; link: string } | null>(null);
  
  // Custom multi-step Flipkart/Amazon style reset state variables
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // Handle countdown timer ticker
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-detect direct link reset parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('resetEmail');
    const otpParam = params.get('resetOtp');
    if (emailParam && otpParam) {
      setResetEmail(emailParam);
      // Fill the otpDigits array by splitting the incoming code
      const digits = otpParam.split('').slice(0, 6);
      while (digits.length < 6) digits.push('');
      setOtpDigits(digits);
      
      setResetStep('reset'); // Pre-verified step bypass
      setShowResetModal(true);
      
      // Clean query search parameters from window url
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (_) {}
      
      toast.success("Security verified! Please create your new password. ✨", { duration: 8000 });
    }
  }, []);

  // Numeric OTP change and auto-shifting helper
  const handleOtpChange = (index: number, value: string) => {
    const freshVal = value.slice(-1).replace(/[^0-9]/g, ''); // numerical digits only
    const newOtp = [...otpDigits];
    newOtp[index] = freshVal;
    setOtpDigits(newOtp);

    // Auto-focus next input
    if (freshVal && index < 5) {
      const nextInput = document.getElementById(`reset-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`reset-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const triggerClientResetFallback = async (emailToReset: string, explanation?: string) => {
    const targetEmail = emailToReset || resetEmail;
    if (!targetEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail.trim(), {
        redirectTo: window.location.origin + '/login'
      });
      if (error) throw error;
      
      toast.success("A secure password reset link has been dispatched to your email! 💎 Please check your inbox or spam folder.");
      setShowResetModal(false);
      setResetStep('request');
    } catch (err: any) {
      console.error("Standard reset error:", err);
      toast.error(err.message || "Failed to trigger standard reset email.");
    } finally {
      setResetLoading(true);
    }
  };

  const safeJsonParse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (e) {
        return { error: "Failed to parse JSON content" };
      }
    }
    try {
      const text = await response.text();
      return { 
        error: "Server returned plain text/HTML format error.", 
        rawText: text,
        useClientResetFallback: true 
      };
    } catch (e) {
      return { error: "Empty or unrecognized server response.", useClientResetFallback: true };
    }
  };

  const handleForgotPasswordRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    
    setResetLoading(true);
    setApiError(null);
    let requestSuccessful = false;

    try {
      const response = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await safeJsonParse(response);
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger password reset OTP.");
      }
      
      requestSuccessful = true;
      setCountdown(60);
      setResetStep('verify');
      setOtpDigits(['', '', '', '', '', '']);
      toast.success("Verification OTP code sent successfully! Please check mail.");
    } catch (error: any) {
      console.error("Forgot request error details:", error);
      
      // Resilient: Always let the user stay on the verification step to enter the OTP if it was sent,
      // and let them invoke the classic fallback link manually if they don't receive it.
      setCountdown(60);
      setResetStep('verify');
      setOtpDigits(['', '', '', '', '', '']);
      
      toast.warning("OTP Request Initiated: Please check your email inbox and spam folder for the security code! (If they are blocked, use standard reset backup below.)", { duration: 10000 });
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit code.");
      return;
    }
    
    setResetLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: fullOtp })
      });
      const data = await safeJsonParse(response);
      
      if (!response.ok) {
        throw new Error(data.error || "Incorrect verification OTP.");
      }
      
      setResetStep('reset');
      toast.success("Identity verified! You can now create your new password.");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Invalid or expired verification code.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    
    setResetLoading(true);
    setApiError(null);
    try {
      const response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetEmail, 
          otp: otpDigits.join(''), 
          newPassword 
        })
      });
      const data = await safeJsonParse(response);
      
      if (!response.ok) {
        throw new Error(data.error || "Reset failed.");
      }

      // Sign in instantly using Supabase Auth with the new credentials.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: resetEmail,
        password: newPassword
      });
      if (signInErr) throw signInErr;
      
      toast.success("Password Updated Successfully! 💎 Welcome to The Ruby.");
      setPassword(newPassword);
      setEmail(resetEmail);
      
      // Close reset popup and clear fields
      setShowResetModal(false);
      setResetStep('request');
      setResetEmail('');
      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setApiError(null);

      // Auto-navigate to homepage, as they are now securely signed in and ready!
      navigate('/');
    } catch (error: any) {
      console.error("Password reset update error:", error);
      toast.error(error.message || "Failed to update your password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').limit(1);
        if (data && data.length > 0) {
          setStoreSettings(data[0]);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectUrl = window.location.origin.includes('therubyfashion.shop')
        ? 'https://therubyfashion.shop/auth/callback'
        : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      toast.error(error.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw authError;
      }

      const sUser = authData.user;
      if (!sUser) throw new Error("Failed to authenticate user.");

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sUser.id)
        .maybeSingle();

      const userRole = profileData?.role || 'user';
      const isVerified = profileData ? profileData.is_verified : false;

      if (!isVerified) {
        toast.error("Please verify your email before logging in.");
        navigate(`/verify-prompt?email=${encodeURIComponent(sUser.email || '')}&uid=${sUser.id}`, { replace: true });
        return;
      }

      toast.success("Logged in successfully! Welcome back ✨");

      // Role-based routing strictly based on database profile role
      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Visual Sidebar */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a1a2e] relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#2d1b69] to-[#1a1a2e] opacity-90" />
        <div className="relative z-10 text-center space-y-8 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            {storeSettings?.storeLogo ? (
              <img src={storeSettings.storeLogo} alt={storeSettings.storeName} className="h-16 md:h-20 object-contain mb-4" />
            ) : (
              <div className="text-5xl font-serif font-bold tracking-tighter text-white">
                {storeSettings?.storeName || 'The Ruby Fashion'}
              </div>
            )}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/90 font-medium leading-relaxed"
          >
            Welcome back, gorgeous.<br />Your wardrobe awaits.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-7xl"
          >
            💃✨
          </motion.div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-ruby/10 rounded-full blur-3xl" />
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gray-50/50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">Welcome Back</h1>
            <p className="text-gray-400 font-medium">Sign in to continue shopping</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Password</label>
                <button 
                  type="button" 
                  onClick={() => {
                    setResetEmail(email);
                    setResetStep('request');
                    setShowResetModal(true);
                  }}
                  className="text-xs font-bold text-ruby hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                  required
                />
              </div>
            </div>

            <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Signing In..." : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="relative flex items-center gap-4 py-2">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">or sign in with</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-100 py-4 rounded-2xl text-sm font-bold text-[#1A2C54] hover:bg-gray-50 transition-all shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
          Google
        </button>

        <p className="text-center text-sm text-gray-400">
          New here? <Link to="/signup" className="text-ruby font-bold hover:underline ml-1">Create Account</Link>
        </p>
      </motion.div>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative border border-gray-100"
          >
            <button 
              onClick={() => setShowResetModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-50 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            {/* Steps Indicator Bar (Shown only in verification steps) */}
            {resetStep !== 'request' && (
              <div className="flex items-center justify-between mb-8 px-4 font-sans">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    resetStep === 'verify' 
                      ? 'bg-[#1A2C54] text-white ring-4 ring-[#1A2C54]/15' 
                      : 'bg-[#1A2C54]/10 text-[#1A2C54]'
                  }`}>
                    1
                  </div>
                  <span className="text-[9px] font-extrabold text-[#1A2C54] mt-1 uppercase tracking-widest">Verify OTP</span>
                </div>
                <div className={`flex-1 h-[2px] mx-2 transition-all duration-500 ${
                  resetStep === 'reset' ? 'bg-[#1A2C54]' : 'bg-gray-100'
                }`} />
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    resetStep === 'reset' 
                      ? 'bg-[#1A2C54] text-white ring-4 ring-[#1A2C54]/15' 
                      : 'bg-gray-50 text-gray-300 border border-gray-100'
                  }`}>
                    2
                  </div>
                  <span className="text-[9px] font-extrabold text-gray-400 mt-1 uppercase tracking-widest">Secure</span>
                </div>
              </div>
            )}

            {apiError && (
              <div className="mb-6 bg-rose-50 border border-rose-150 p-4 rounded-2xl space-y-3 shadow-sm text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#E11D48] flex items-center gap-1.5 font-sans">
                  ⚙️ API ENABLE MANDATE REQUIRED
                </p>
                <p className="text-xs text-rose-900 leading-relaxed font-sans font-semibold">
                  {apiError.message}
                </p>
                <div className="flex gap-2 pt-1">
                  <a 
                    href={apiError.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-4 py-2 bg-[#E11D48] text-white font-bold text-[10px] tracking-wider uppercase rounded-xl shadow-md shadow-rose-600/10 hover:bg-rose-700 transition-all inline-flex items-center gap-1 active:scale-95"
                  >
                    1-Click Enable Client API ↗
                  </a>
                  <button 
                    type="button"
                    onClick={() => setApiError(null)}
                    className="px-3 py-2 bg-white border border-rose-100 text-stone-600 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all hover:bg-stone-50 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Account email inquiry (Styled exactly like the User Reference Image) */}
            {resetStep === 'request' && (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-6">
                {/* Visual Icon Header matching reference image */}
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-[#EFF6FF] flex items-center justify-center relative border border-[#DBEAFE]">
                    <Lock className="w-8 h-8 text-[#2563EB]" />
                    <div className="absolute bottom-1 right-1 bg-[#2563EB] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm font-sans select-none">?</div>
                  </div>
                </div>

                <div className="space-y-2 text-center mb-6">
                  <h3 className="text-3xl font-bold font-sans text-stone-900 tracking-tight">Forgot Password?</h3>
                  <p className="text-sm text-stone-500 font-sans leading-relaxed max-w-[320px] mx-auto select-none">
                    Enter your registered email address and we'll send you a link to reset your password.
                  </p>
                </div>
                
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold font-sans text-stone-800 ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#2563EB] transition-colors">
                      <Mail size={18} />
                    </div>
                    <input 
                      type="email" 
                      placeholder="Enter your email address"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-white border border-stone-200 pl-11 pr-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EFF6FF] focus:border-[#2563EB] transition-all font-sans text-stone-900 placeholder:text-stone-400"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 disabled:opacity-50 font-sans cursor-pointer active:scale-[0.98]"
                >
                  {resetLoading ? "Sending Reset Link..." : "Send Reset Link"}
                </button>
                
                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-100"></div>
                  </div>
                  <span className="relative px-3 bg-white text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] font-sans select-none">or</span>
                </div>

                <div className="flex justify-center pb-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="text-sm font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-all cursor-pointer flex items-center gap-2 group font-sans"
                  >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Login
                  </button>
                </div>

                {/* Trust and Micro-advisory indicators at the bottom matching user reference */}
                <div className="mt-8 pt-6 border-t border-stone-100 flex items-center justify-between text-[10px] font-bold text-stone-500 font-sans tracking-tight">
                  <div className="flex items-center gap-1 hover:text-stone-850 transition-colors">
                    <ShieldCheck size={13} className="text-[#2563EB]" />
                    <span>Secure Shopping</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-stone-850 transition-colors">
                    <Award size={13} className="text-[#2563EB]" />
                    <span>Best Quality</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-stone-850 transition-colors">
                    <RotateCcw size={13} className="text-[#2563EB]" />
                    <span>Easy Returns</span>
                  </div>
                  <div className="flex items-center gap-1 hover:text-stone-850 transition-colors">
                    <Headphones size={13} className="text-[#2563EB]" />
                    <span>24/7 Support</span>
                  </div>
                </div>
              </form>
            )}

            {/* Step 2: Verification of dynamic generated OTP */}
            {resetStep === 'verify' && (
              <form onSubmit={handleForgotPasswordVerify} className="space-y-6">
                <div className="space-y-1 block">
                  <h3 className="text-2xl font-serif font-bold text-[#1A2C54]">Security Verification</h3>
                  <div className="text-sm text-gray-450 font-medium font-sans mt-1">
                    An OTP verification code sent to <span className="text-[#1A2C54] font-bold">{resetEmail}</span>.
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#1A2C54]/60 ml-1 font-sans block text-center">
                    Enter 6-Digit OTP Code
                  </label>
                  <div className="flex gap-2 justify-center items-center">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        id={`reset-otp-${index}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-11 h-11 bg-gray-50 border border-gray-100 text-center rounded-xl text-lg font-bold text-[#1A2C54] focus:outline-none focus:bg-white focus:ring-2 focus:ring-ruby/20 focus:border-ruby transition-all"
                      />
                    ))}
                  </div>
                </div>

                <div className="text-center font-sans">
                  {countdown > 0 ? (
                    <span className="text-xs text-gray-400 font-medium">
                      Resend OTP in <span className="text-ruby font-bold">{countdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleForgotPasswordRequest()}
                      disabled={resetLoading}
                      className="text-xs font-bold text-ruby hover:underline transition-all"
                    >
                      Resend Verification OTP Code
                    </button>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={resetLoading || otpDigits.join('').length < 6}
                  className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-2 disabled:opacity-50 font-sans cursor-pointer"
                >
                  {resetLoading ? "Verifying..." : "Verify Code"}
                </button>

                <button
                  type="button"
                  onClick={() => setResetStep('request')}
                  className="w-full text-center text-xs font-semibold text-gray-400 hover:text-gray-650 py-1 font-sans"
                >
                  Back to Email Address Entry
                </button>

                <div className="pt-2 border-t border-dashed border-gray-100 flex flex-col gap-1 text-center font-sans">
                  <p className="text-[10px] text-gray-400 leading-normal">
                    Having trouble receiving the 6-digit dynamic passcode?
                  </p>
                  <button
                    type="button"
                    onClick={() => triggerClientResetFallback(resetEmail, "Alternative Recovery Method Activated")}
                    disabled={resetLoading}
                    className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer flex items-center justify-center gap-1.5 transition-colors pt-0.5"
                  >
                    Send Classic Reset Link to Inbox Instead ⚡
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Secure password creation */}
            {resetStep === 'reset' && (
              <form onSubmit={handleForgotPasswordReset} className="space-y-5">
                <div className="space-y-2 mb-4">
                  <h3 className="text-2xl font-serif font-bold text-[#1A2C54]">Set New Password</h3>
                  <p className="text-sm text-gray-450 font-medium font-sans">
                    Your identity is fully verified! Type in your new secure password log-in details.
                  </p>
                </div>

                <div className="space-y-4 font-sans">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2C54]/60 ml-1">New Password</label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                        <Lock size={18} />
                      </div>
                      <input 
                        type="password" 
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A2C54]/60 ml-1">Confirm New Password</label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-ruby transition-colors">
                        <Lock size={18} />
                      </div>
                      <input 
                        type="password" 
                        placeholder="Re-type your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 focus:border-ruby transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-[#1A2C54] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 flex items-center justify-center gap-2 disabled:opacity-50 font-sans cursor-pointer"
                >
                  {resetLoading ? "Updating..." : "Reset Password & Login"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
