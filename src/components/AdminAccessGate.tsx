import React, { useState } from 'react';
import { useAuth, ADMIN_EMAILS } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowRight, ArrowLeft, Key, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccessGate() {
  const { user, profile, grantAdminAccess } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePasscodeUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      toast.error("Please enter the admin passcode");
      return;
    }

    setIsSubmitting(true);
    const success = grantAdminAccess(passcode.trim());
    setIsSubmitting(false);

    if (success) {
      toast.success("Admin access granted! Welcome to The Ruby Admin Panel.");
    } else {
      toast.error("Invalid admin passcode. Please check and try again.");
    }
  };

  const handleGoogleAdminLogin = async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?redirect=/admin`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          }
        }
      });
      if (error) {
        toast.error(error.message);
      }
    } catch (err: any) {
      toast.error("Failed to initiate Google sign-in: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-center items-center p-4 selection:bg-ruby selection:text-white">
      <div className="w-full max-w-md bg-[#1E293B] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-ruby/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-3 mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-ruby/10 border border-ruby/30 flex items-center justify-center text-ruby shadow-inner">
            <Lock size={32} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-white">The Ruby Fashion</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Admin Control Center & Portal Access</p>
          </div>
        </div>

        {/* Status notice */}
        {user ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 mb-6 text-xs text-amber-200 flex items-start space-x-2.5">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Current Account:</span> {user.email || 'Signed In'}
              <p className="text-[11px] text-gray-400 mt-1">
                This account is not designated as an admin. Enter the master passcode below or switch to your admin email ({ADMIN_EMAILS[0]}).
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-3.5 mb-6 text-xs text-gray-300 flex items-center space-x-2.5">
            <ShieldAlert size={16} className="text-ruby shrink-0" />
            <span>Restricted Area. Authorized store staff & owner access only.</span>
          </div>
        )}

        {/* Option 1: Passcode Unlock */}
        <form onSubmit={handlePasscodeUnlock} className="space-y-4 mb-6">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Master Admin Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full bg-[#0F172A] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-ruby transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-ruby hover:bg-[#8F162E] text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-ruby/20 flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
          >
            <Key size={14} />
            <span>{isSubmitting ? 'Verifying...' : 'Unlock Admin Panel'}</span>
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-gray-700 w-full" />
          <span className="bg-[#1E293B] px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 relative">
            OR SIGN IN
          </span>
        </div>

        {/* Option 2: Sign in with Admin Google */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-4 rounded-xl text-xs tracking-wider transition-all flex items-center justify-center space-x-2.5 shadow"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign In with Google ({ADMIN_EMAILS[0]})</span>
          </button>

          <Link
            to="/login?redirect=/admin"
            className="w-full block text-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 px-4 rounded-xl text-xs transition-colors"
          >
            Sign In with Email / Password
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800 text-center">
          <Link
            to="/"
            className="inline-flex items-center text-xs text-gray-400 hover:text-white transition-colors space-x-1"
          >
            <ArrowLeft size={13} />
            <span>Return to Store Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
